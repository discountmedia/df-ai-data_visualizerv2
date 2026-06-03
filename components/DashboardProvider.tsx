"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import type {
  ParsedFile,
  SchemaProfile,
  SchemaOverrides,
  EntitySet,
} from "@/lib/types";
import { parseSpreadsheet } from "@/lib/parseFile";
import { inferSchemaClient } from "@/lib/inferSchemaClient";
import { heuristicSchema } from "@/lib/profile";
import { detectEntities } from "@/lib/entities";
import { makeSampleData } from "@/lib/sampleData";

export type Phase = "idle" | "parsing" | "inferring" | "review" | "ready" | "error";

interface State {
  phase: Phase;
  parsed?: ParsedFile;
  entities?: EntitySet;
  schema?: SchemaProfile;
  overrides: SchemaOverrides;
  usedFallback: boolean;
  inferenceNote?: string;
  error?: string;
  locationFilter: string;
  activeTab: string;
  /** True while the AI schema is being refined in the background (data already shown). */
  schemaRefining: boolean;
}

type Action =
  | { type: "PARSING" }
  | { type: "INFERRING"; parsed: ParsedFile; entities: EntitySet }
  | { type: "REVIEW"; schema: SchemaProfile; usedFallback: boolean; note?: string }
  | { type: "READY"; overrides: SchemaOverrides }
  | { type: "READY_WITH_SCHEMA"; schema: SchemaProfile; usedFallback: boolean; note?: string; overrides: SchemaOverrides; refining?: boolean }
  | { type: "UPGRADE_SCHEMA"; schema: SchemaProfile; usedFallback: boolean; note?: string; overrides: SchemaOverrides }
  | { type: "ERROR"; error: string }
  | { type: "SET_LOCATION"; location: string }
  | { type: "SET_TAB"; tab: string }
  | { type: "BACK_TO_REVIEW" }
  | { type: "RESET" };

const initialState: State = {
  phase: "idle",
  overrides: { vetoedColumns: [] },
  usedFallback: false,
  locationFilter: "ALL",
  activeTab: "",
  schemaRefining: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "PARSING":
      return { ...initialState, phase: "parsing" };
    case "INFERRING":
      return { ...state, phase: "inferring", parsed: action.parsed, entities: action.entities };
    case "REVIEW":
      return {
        ...state,
        phase: "review",
        schema: action.schema,
        usedFallback: action.usedFallback,
        inferenceNote: action.note,
        overrides: { vetoedColumns: [] },
      };
    case "READY":
      // Reset the location filter: the kept columns may have changed in review,
      // so a stale selection could otherwise filter on a now-vetoed column.
      return { ...state, phase: "ready", overrides: action.overrides, locationFilter: "ALL", activeTab: "" };
    case "READY_WITH_SCHEMA":
      // Auto-load path: infer + confirm in one step, no schema-review screen.
      return {
        ...state, phase: "ready", schema: action.schema, usedFallback: action.usedFallback,
        inferenceNote: action.note, overrides: action.overrides, locationFilter: "ALL", activeTab: "",
        schemaRefining: action.refining ?? false,
      };
    case "UPGRADE_SCHEMA":
      // Background AI refinement landed — swap the schema in WITHOUT disturbing the
      // user's current tab / location filter. Everything re-derives from the new schema.
      return {
        ...state, schema: action.schema, usedFallback: action.usedFallback,
        inferenceNote: action.note, overrides: action.overrides, schemaRefining: false,
      };
    case "ERROR":
      return { ...state, phase: "error", error: action.error };
    case "SET_LOCATION":
      return { ...state, locationFilter: action.location };
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    case "BACK_TO_REVIEW":
      return { ...state, phase: "review" };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface Ctx extends State {
  loadFile: (file: File) => Promise<void>;
  loadSample: () => Promise<void>;
  loadAutoData: () => Promise<void>;
  confirmSchema: (overrides: SchemaOverrides) => void;
  backToReview: () => void;
  setLocation: (loc: string) => void;
  setTab: (tab: string) => void;
  reset: () => void;
}

const DashboardCtx = createContext<Ctx | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const runInference = useCallback(async (parsed: ParsedFile) => {
    const entities = detectEntities(parsed);
    dispatch({ type: "INFERRING", parsed, entities });
    try {
      const { schema, usedFallback, note } = await inferSchemaClient(parsed);
      dispatch({ type: "REVIEW", schema, usedFallback, note });
    } catch (err) {
      dispatch({ type: "ERROR", error: err instanceof Error ? err.message : "Inference failed." });
    }
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      dispatch({ type: "PARSING" });
      try {
        const parsed = await parseSpreadsheet(file);
        await runInference(parsed);
      } catch (err) {
        dispatch({ type: "ERROR", error: err instanceof Error ? err.message : "Could not read file." });
      }
    },
    [runInference]
  );

  // Auto-load the bundled test export, infer its schema, and land directly on the
  // dashboard — no upload splash, no schema-review step. This is how it runs live
  // (the backend will feed the same shape of data).
  const loadAutoData = useCallback(async () => {
    dispatch({ type: "PARSING" });
    try {
      const res = await fetch("/CuratedFields-TEST.xlsx");
      if (!res.ok) throw new Error(`Could not load bundled data (${res.status}).`);
      const blob = await res.blob();
      const file = new File([blob], "CuratedFields-TEST.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const parsed = await parseSpreadsheet(file);
      const entities = detectEntities(parsed);
      const overridesFor = (s: SchemaProfile) => ({
        vetoedColumns: s.columns.filter((c) => c.trust === "deprecated" || c.trust === "duplicate").map((c) => c.name),
      });

      // 1. Show good data immediately on the instant, client-side heuristic schema.
      //    INFERRING sets parsed + entities into state; READY_WITH_SCHEMA (batched
      //    in the same tick) flips to ready WITHOUT clobbering them.
      const heuristic = heuristicSchema(parsed.rows);
      dispatch({ type: "INFERRING", parsed, entities });
      dispatch({ type: "READY_WITH_SCHEMA", schema: heuristic, usedFallback: true, overrides: overridesFor(heuristic), refining: true });

      // 2. Refine with AI in the background, then swap it in seamlessly (the user
      //    keeps looking at real numbers the whole time; tab + filter are preserved).
      try {
        const { schema, usedFallback, note } = await inferSchemaClient(parsed);
        dispatch({ type: "UPGRADE_SCHEMA", schema, usedFallback, note, overrides: overridesFor(schema) });
      } catch {
        dispatch({ type: "UPGRADE_SCHEMA", schema: heuristic, usedFallback: true, overrides: overridesFor(heuristic) });
      }
    } catch (err) {
      dispatch({ type: "ERROR", error: err instanceof Error ? err.message : "Could not auto-load data." });
    }
  }, []);

  const loadSample = useCallback(async () => {
    dispatch({ type: "PARSING" });
    try {
      const { rows, columns } = makeSampleData();
      const parsed: ParsedFile = {
        fileName: "sample_inventory.xlsx",
        sheetName: "Sheet1",
        sheetNames: ["Sheet1"],
        rows,
        columns,
      };
      await runInference(parsed);
    } catch (err) {
      dispatch({ type: "ERROR", error: err instanceof Error ? err.message : "Could not load sample." });
    }
  }, [runInference]);

  const value: Ctx = {
    ...state,
    loadFile,
    loadSample,
    loadAutoData,
    confirmSchema: (overrides) => dispatch({ type: "READY", overrides }),
    backToReview: () => dispatch({ type: "BACK_TO_REVIEW" }),
    setLocation: (loc) => dispatch({ type: "SET_LOCATION", location: loc }),
    setTab: (tab) => dispatch({ type: "SET_TAB", tab }),
    reset: () => dispatch({ type: "RESET" }),
  };

  return <DashboardCtx.Provider value={value}>{children}</DashboardCtx.Provider>;
}

export function useDashboard(): Ctx {
  const ctx = useContext(DashboardCtx);
  if (!ctx) throw new Error("useDashboard must be used within <DashboardProvider>.");
  return ctx;
}

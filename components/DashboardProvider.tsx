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
}

type Action =
  | { type: "PARSING" }
  | { type: "INFERRING"; parsed: ParsedFile; entities: EntitySet }
  | { type: "REVIEW"; schema: SchemaProfile; usedFallback: boolean; note?: string }
  | { type: "READY"; overrides: SchemaOverrides }
  | { type: "ERROR"; error: string }
  | { type: "SET_LOCATION"; location: string }
  | { type: "BACK_TO_REVIEW" }
  | { type: "RESET" };

const initialState: State = {
  phase: "idle",
  overrides: { vetoedColumns: [] },
  usedFallback: false,
  locationFilter: "ALL",
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
      return { ...state, phase: "ready", overrides: action.overrides };
    case "ERROR":
      return { ...state, phase: "error", error: action.error };
    case "SET_LOCATION":
      return { ...state, locationFilter: action.location };
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
  confirmSchema: (overrides: SchemaOverrides) => void;
  backToReview: () => void;
  setLocation: (loc: string) => void;
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
    confirmSchema: (overrides) => dispatch({ type: "READY", overrides }),
    backToReview: () => dispatch({ type: "BACK_TO_REVIEW" }),
    setLocation: (loc) => dispatch({ type: "SET_LOCATION", location: loc }),
    reset: () => dispatch({ type: "RESET" }),
  };

  return <DashboardCtx.Provider value={value}>{children}</DashboardCtx.Provider>;
}

export function useDashboard(): Ctx {
  const ctx = useContext(DashboardCtx);
  if (!ctx) throw new Error("useDashboard must be used within <DashboardProvider>.");
  return ctx;
}

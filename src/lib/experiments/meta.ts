// Lightweight metadata for experiments, safe to import on the client.

export type ExperimentMeta = {
  id: string;
  name: string;
  description: string;
};

export const experimentsMeta: ExperimentMeta[] = [];

export const defaultExperimentId = experimentsMeta[0]?.id || '';

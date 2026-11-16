// tools/lib/schema.mjs — JSON Schema (draft 2020-12) generation from the prop registry.
// One source of truth: prop meta -> per-prop schemas -> the script schema. Models with
// structured-output / function-calling support can be constrained by this schema directly,
// so a script that passes schema-check also passes validate's slot/option checks (PR2).
// Usage: import { propSchema, layerSchema, scriptSchema } from './lib/schema.mjs';
//        scriptSchema(defs)  ->  JSON Schema for a whole script.json

import { normSpec, isRequired } from './types.mjs';
import { CAMERA_MOVES, SFX_TYPES } from '../validate.mjs';

export const SCHEMA_VERSION = 1;
const CUE_PATTERN = '^(?:start|end|t:\\d+(?:\\.\\d+)?|word:\\S+?)(?:[+-]\\d*\\.?\\d+s)?$';

const lengthDef = {
  oneOf: [
    { type: 'number' },
    { type: 'string', pattern: '^-?\\d+(\\.\\d+)?%?$' },
    {
      type: 'object',
      properties: {},
      additionalProperties: { $ref: '#/$defs/length' },
      minProperties: 1,
    },
  ],
};

const cue = { type: 'string', pattern: CUE_PATTERN, description: 'Cue: "start", "end", "t:1.5", "word:kong" or "word:the#2", optionally +0.2s / -0.1s' };

const UNIVERSAL = {
  x: { $ref: '#/$defs/length', description: 'Centre x (px or "50%")' },
  y: { $ref: '#/$defs/length', description: 'Centre y (px or "50%")' },
  w: { $ref: '#/$defs/length', description: 'Width (px or "50%")' },
  h: { $ref: '#/$defs/length', description: 'Height (px or "50%")' },
  r: { $ref: '#/$defs/length', description: 'Corner radius' },
  rot: { type: 'number', description: 'Rotation in degrees' },
  scale: { type: 'number', description: 'Uniform scale (1 = none)' },
  opacity: { type: 'number', minimum: 0, maximum: 1 },
  pad: {
    oneOf: [{ type: 'number' }, { type: 'string', pattern: '^-?\\d+(\\.\\d+)?%$' }],
    description: 'With "target": expand the inherited box by this much (px or % of target width)',
  },
};

function specToSchema(s) {
  if (!s || s.base === 'unknown') return {};
  const out = {};
  if (s.doc) out.description = s.doc;
  switch (s.base) {
    case 'string': case 'asset': case 'color': out.type = 'string'; break;
    case 'number': out.type = 'number'; break;
    case 'boolean': out.type = 'boolean'; break;
    case 'length': return { $ref: '#/$defs/length', ...(s.doc ? { description: s.doc } : {}) };
    case 'array': out.type = 'array'; break;
    case 'object': out.type = 'object'; break;
    case 'enum': out.enum = s.values; break;
    case 'range': out.type = 'number'; out.minimum = s.min; out.maximum = s.max; break;
    default: return s.doc ? { description: s.doc } : {};
  }
  if (s.default !== undefined) out.default = s.default;
  return out;
}

function bagSchema(meta, bag) {
  const specs = Object.fromEntries(Object.entries(meta?.[bag] ?? {}).map(([k, v]) => [k, normSpec(v)]));
  const properties = Object.fromEntries(Object.entries(specs).map(([k, s]) => [k, specToSchema(s)]));
  const out = { type: 'object', properties };
  // Options are NEVER required (validate only enforces required slots) — mirror that contract.
  if (bag === 'slots') {
    const required = Object.entries(specs).filter(([, s]) => isRequired(s)).map(([k]) => k);
    if (required.length) out.required = required;
    out.additionalProperties = false;
  } else {
    Object.assign(properties, UNIVERSAL); // x/y/w/h/... apply to every prop
  }
  return out;
}

/** Per-prop schema: { slots, options } shape for one prop. */
export function propSchema(def) {
  const m = def?.meta ?? {};
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: `${m.name} layer body`,
    description: `${m.use ?? ''} Avoid: ${m.avoid ?? ''}`.trim(),
    type: 'object',
    properties: { slots: bagSchema(m, 'slots'), options: bagSchema(m, 'options') },
    required: ['slots'],
  };
}

/** A single layers[] item: discriminated by "prop" via allOf/if-then (function-calling friendly). */
export function layerSchema(defs) {
  const names = Object.keys(defs);
  return {
    type: 'object',
    properties: {
      prop: { enum: names, description: 'Which prop draws this layer' },
      slots: { type: 'object', description: 'Content (per-prop shape below)' },
      options: { type: 'object', description: 'Look + placement (per-prop shape below, plus universal x/y/w/h/r/rot/scale/opacity/pad)' },
      at: cue, until: cue,
      depth: { type: 'number', minimum: 0, maximum: 1 },
      z: { type: 'number' },
      space: { enum: ['world', 'screen'] },
      enter: { type: 'number', description: 'Entrance seconds' },
      exit: { type: 'number', description: 'Exit seconds' },
      id: { type: 'string', description: 'Unique id across the whole script; also the "target" for annotations' },
      target: { type: 'string', description: 'Lock onto an earlier layer by id: inherit its box, space and depth' },
    },
    required: ['prop'],
    additionalProperties: false,
    allOf: names.map((n) => ({
      if: { properties: { prop: { const: n } }, required: ['prop'] },
      then: {
        properties: {
          slots: bagSchema(defs[n].meta, 'slots'),
          options: bagSchema(defs[n].meta, 'options'),
        },
      },
    })),
  };
}

/** The whole script.json schema. `defs` = prop defs map (toDefs(discoverProps().props)). */
export function scriptSchema(defs) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://vox-style/schema/script.schema.json',
    title: 'vox-style script',
    description: 'A vox-style video script: narration lines, shots, prop layers, assets. schemaVersion ' + SCHEMA_VERSION,
    type: 'object',
    required: ['lines', 'shots'],
    properties: {
      schemaVersion: { const: SCHEMA_VERSION },
      meta: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          aspect: { enum: ['9:16', '16:9'], description: 'Honoured when no --aspect flag is given' },
          theme: { type: 'string' },
          fps: { type: 'number' },
          grain: { type: 'boolean' },
          captions: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      assets: { type: 'object', additionalProperties: { type: 'string' }, description: 'Preload manifest: key -> path' },
      lines: {
        type: 'array', minItems: 1,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' }, text: { type: 'string' },
            say: { type: 'string', description: 'Spoken text when it differs from text' },
            caps: { anyOf: [{ type: 'string' }, { type: 'boolean', enum: [false] }], description: 'Caption chunks: | splits, *word* highlights' },
          },
          required: ['id', 'text'],
          additionalProperties: false,
        },
      },
      shots: {
        type: 'array', minItems: 1,
        items: {
          type: 'object',
          properties: {
            line: { type: 'string' },
            span: { type: 'array', items: cue, minItems: 2, maxItems: 2 },
            camera: {
              // The director normalises a bare move string, so accept both forms.
              anyOf: [
                { type: 'string' },
                {
                  type: 'object',
                  properties: {
                    move: { enum: CAMERA_MOVES },
                    amount: { type: 'number' },
                    focus: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, additionalProperties: false },
                    ease: { type: 'string' },
                  },
                  additionalProperties: false,
                },
              ],
            },
            layers: { type: 'array', items: layerSchema(defs) },
            transition: {
              type: 'object',
              properties: {
                type: { enum: Object.keys(defs).filter((n) => defs[n].meta?.category === 'transitions') },
                duration: { type: 'number', exclusiveMinimum: 0 },
                slots: { type: 'object' },
                options: { type: 'object' },
              },
              required: ['type'],
              additionalProperties: false,
            },
            sfx: {
              type: 'array',
              items: {
                type: 'object',
                properties: { type: { enum: SFX_TYPES }, at: cue, gain: { type: 'number', minimum: 0 } },
                required: ['type'],
                additionalProperties: false,
              },
            },
          },
          required: ['line'],
          additionalProperties: false,
        },
      },
    },
    $defs: { length: lengthDef, cue },
  };
}

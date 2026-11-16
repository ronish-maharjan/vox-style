// tools/lib/schema-check.mjs — dependency-free checker for the JSON Schema subset that
// tools/lib/schema.mjs emits (draft 2020-12 subset: type, enum, const, required,
// properties, items, minItems/maxItems, additionalProperties, oneOf/anyOf/allOf/if-then,
// $ref to #/$defs, minimum/maximum/exclusiveMinimum, pattern). Returns [{path, message}];
// an empty array means valid. Phase 2 of the plan can swap this for a full validator,
// but the emitted subset is small and this keeps the toolchain dependency-free.

const TYPES = ['object', 'array', 'string', 'number', 'boolean', 'null'];

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function matchesType(v, t) {
  const tv = typeOf(v);
  if (t === 'number' || t === 'integer') return tv === 'number' || tv === 'integer';
  return tv === t;
}

function resolveRef(schema, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/$defs/')) return null;
  return schema.$defs?.[ref.slice('#/$defs/'.length)] ?? null;
}

export function schemaCheck(schema, value, path = '$', out = null, root = null) {
  out = out ?? [];
  root = root ?? schema;
  if (!schema || typeof schema !== 'object') return out;

  if (schema.$ref) {
    const r = resolveRef(root, schema.$ref);
    if (r) schemaCheck(r, value, path, out, root);
    return out;
  }

  if (schema.const !== undefined && value !== schema.const) {
    out.push({ path, message: `must be ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}` });
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
    out.push({ path, message: `must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(' | ')}, got ${JSON.stringify(value)}` });
  }
  if (schema.type !== undefined) {
    const ok = Array.isArray(schema.type) ? schema.type.some((t) => matchesType(value, t)) : matchesType(value, schema.type);
    if (!ok) out.push({ path, message: `must be of type ${Array.isArray(schema.type) ? schema.type.join('|') : schema.type}, got ${typeOf(value)}` });
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) out.push({ path, message: `must be >= ${schema.minimum}` });
    if (schema.maximum !== undefined && value > schema.maximum) out.push({ path, message: `must be <= ${schema.maximum}` });
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) out.push({ path, message: `must be > ${schema.exclusiveMinimum}` });
  }
  if (typeof value === 'string' && schema.pattern) {
    try { if (!new RegExp(schema.pattern).test(value)) out.push({ path, message: `does not match ${schema.pattern}` }); }
    catch { /* bad pattern in schema: ignore, the schema tests catch that */ }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) out.push({ path, message: `needs at least ${schema.minItems} item(s), got ${value.length}` });
    if (schema.maxItems !== undefined && value.length > schema.maxItems) out.push({ path, message: `allows at most ${schema.maxItems} item(s), got ${value.length}` });
    if (schema.items) value.forEach((v, i) => schemaCheck(schema.items, v, `${path}[${i}]`, out, root));
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const props = schema.properties ?? {};
    for (const k of schema.required ?? []) {
      if (!(k in value)) out.push({ path, message: `missing required property "${k}"` });
    }
    for (const [k, v] of Object.entries(value)) {
      if (k in props) schemaCheck(props[k], v, `${path}.${k}`, out, root);
      else if (schema.additionalProperties === false) out.push({ path, message: `unknown property "${k}" (allowed: ${Object.keys(props).join(', ') || 'none'})` });
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        schemaCheck(schema.additionalProperties, v, `${path}.${k}`, out, root);
      }
    }
  }

  if (schema.allOf) for (const s of schema.allOf) schemaCheck(s, value, path, out, root);
  if (schema.oneOf) {
    const passes = schema.oneOf.filter((s) => schemaCheck(s, value, path, [], root).length === 0).length;
    if (passes !== 1) out.push({ path, message: `must match exactly one of the oneOf branches (${passes} matched)` });
  }
  if (schema.anyOf) {
    const passes = schema.anyOf.filter((s) => schemaCheck(s, value, path, [], root).length === 0).length;
    if (passes === 0) out.push({ path, message: 'does not match any allowed shape (anyOf)' });
  }
  if (schema.if) {
    const ok = schemaCheck(schema.if, value, path, [], root).length === 0;
    if (ok && schema.then) schemaCheck(schema.then, value, path, out, root);
    if (!ok && schema.else) schemaCheck(schema.else, value, path, out, root);
  }

  return out;
}

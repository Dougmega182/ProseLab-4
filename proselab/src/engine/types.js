/**
 * SEMANTIC CONTENT TYPES
 * Hierarchical ontology for content types.
 */

export const CONTENT_TYPES = {
  OBJECT_DESC: "OBJECT_DESC", // Generic
  LOCATION: "LOCATION",       // Supertype
  ADDRESS: "ADDRESS",         // Specific
  COORDINATES: "COORDINATES", // Specific
  INFORMATION: "INFORMATION", // Generic
  SECRET: "SECRET",           // Specific
  NAME: "NAME"                // Specific
};

export const TYPE_HIERARCHY = {
  [CONTENT_TYPES.ADDRESS]: [CONTENT_TYPES.LOCATION, CONTENT_TYPES.OBJECT_DESC],
  [CONTENT_TYPES.COORDINATES]: [CONTENT_TYPES.LOCATION, CONTENT_TYPES.OBJECT_DESC],
  [CONTENT_TYPES.LOCATION]: [CONTENT_TYPES.OBJECT_DESC],
  [CONTENT_TYPES.SECRET]: [CONTENT_TYPES.INFORMATION, CONTENT_TYPES.OBJECT_DESC],
  [CONTENT_TYPES.NAME]: [CONTENT_TYPES.INFORMATION, CONTENT_TYPES.OBJECT_DESC],
  [CONTENT_TYPES.INFORMATION]: [CONTENT_TYPES.OBJECT_DESC],
};

/**
 * Checks if type1 is compatible with type2 (identity, subtype, or supertype)
 */
export function areTypesCompatible(t1, t2) {
  if (!t1 || !t2) return true; // Missing type is maximally permissive
  if (t1 === t2) return true;
  
  // Check if t1 is a subtype of t2 (t1 has t2 in its ancestors)
  const ancestors1 = TYPE_HIERARCHY[t1] || [];
  if (ancestors1.includes(t2)) return true;

  // Check if t2 is a subtype of t1 (t2 has t1 in its ancestors)
  const ancestors2 = TYPE_HIERARCHY[t2] || [];
  if (ancestors2.includes(t1)) return true;

  return false;
}

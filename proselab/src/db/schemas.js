/**
 * Database Schemas (Documentation)
 * These definitions document the expected shape of data in StoryforgeDB.
 */

export const ProjectSchema = {
  id: 'auto',
  title: 'string',
  subtitle: 'string?',
  genre: 'string?',
  logline: 'string?',
  targetWordCount: 'number?',
  currentWordCount: 'number', // computed, cached
  voiceProfileId: 'string?',
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

export const ChapterSchema = {
  id: 'auto',
  projectId: 'string',
  order: 'number',
  title: 'string',
  summary: 'string?',
  targetWordCount: 'number?',
  currentWordCount: 'number', // computed, cached
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

export const SceneSchema = {
  id: 'auto',
  chapterId: 'string',
  projectId: 'string',
  order: 'number',
  title: 'string?',
  beat: 'string', // What this scene needs to accomplish
  prose: 'string', // Current prose content
  wordCount: 'number',
  status: 'string', // draft | generated | reviewed | approved | locked
  currentVersion: 'number',
  pov: 'string?', // POV character name
  location: 'string?',
  timeframe: 'string?',
  mood: 'string?',
  summary: 'string?', // Generated summary
  validationResult: 'object?', // Last validation result
  critiqueResult: 'object?', // Last critique result
  generationConfig: 'object?', // Config used for last generation
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

export const SceneVersionSchema = {
  id: 'auto',
  sceneId: 'string',
  version: 'number',
  prose: 'string',
  wordCount: 'number',
  source: 'string', // 'generated' | 'manual_edit' | 'revision'
  generationLog: 'object?', // Which LLM call produced this
  createdAt: 'timestamp'
};

export const EntitySchema = {
  id: 'auto',
  projectId: 'string',
  name: 'string',
  type: 'string', // character | location | item | faction | concept | event
  description: 'string',
  physicalDescription: 'string?',
  currentState: 'object', // { key: value } — mutable attributes
  permanentTraits: 'object', // { key: value } — immutable attributes
  aliases: 'string[]',
  relationships: 'array', // [{ targetName, relationshipType, description }]
  history: 'array', // [{ description, sceneId, timestamp, attribute?, previousValue?, newValue? }]
  tags: 'string[]',
  notes: 'string?', // Writer's private notes
  firstAppearance: 'string?', // sceneId
  lastModifiedScene: 'string?',
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

export const ShadowActionSchema = {
  id: 'auto',
  projectId: 'string',
  sceneId: 'string',
  type: 'string', // ADD_ENTITY | UPDATE_STATE | UPDATE_RELATIONSHIP | FLAG_CONTRADICTION
  confidence: 'number',
  reasoning: 'string',
  payload: 'object',
  status: 'string', // pending | approved | modified | rejected
  modifiedPayload: 'object?', // If the writer modified before approving
  reviewedAt: 'timestamp?',
  createdAt: 'timestamp'
};

export const GenerationLogSchema = {
  id: 'auto',
  projectId: 'string',
  sceneId: 'string?',
  stage: 'string', // generation | validation | critique | extraction | calibration | summary
  model: 'string',
  inputTokens: 'number',
  outputTokens: 'number',
  elapsed: 'number', // ms
  estimatedCost: 'number?',
  prompt: 'string?', // Optional — can be large, maybe store separately
  response: 'string?',
  createdAt: 'timestamp'
};

export const OutlineNodeSchema = {
  id: 'auto',
  projectId: 'string',
  parentId: 'string?', // null for root nodes
  order: 'number',
  type: 'string', // act | chapter | scene | beat
  title: 'string',
  description: 'string?',
  linkedSceneId: 'string?', // If this beat maps to a scene
  status: 'string', // planned | in_progress | complete
  tags: 'string[]',
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

export enum CustomFieldType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  SINGLE_SELECT = 'single_select',
  MULTI_SELECT = 'multi_select',
  CHECKBOX = 'checkbox',
  PERSON = 'person',
  URL = 'url',
}

export type CustomFieldValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | null;

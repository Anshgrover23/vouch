import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  integer,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  confidenceThreshold: numeric("confidence_threshold", { precision: 4, scale: 3 })
    .notNull()
    .default("0.920"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  billingStatus: text("billing_status").notNull().default("none"),
  ...timestamps,
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  ...timestamps,
}, (t) => [
  uniqueIndex("memberships_workspace_user_idx").on(t.workspaceId, t.userId),
  index("memberships_user_idx").on(t.userId),
]);

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  information: text("information"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...timestamps,
}, (t) => [
  index("groups_workspace_idx").on(t.workspaceId),
  index("groups_created_by_idx").on(t.createdBy),
  uniqueIndex("groups_workspace_name_idx").on(t.workspaceId, sql`lower(btrim(${t.name}))`),
]);

export const groupMembers = pgTable("group_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  inviteToken: text("invite_token").notNull().default(sql`gen_random_uuid()::text`),
  status: text("status").notNull().default("invited"),
  ...timestamps,
}, (t) => [
  uniqueIndex("group_members_invite_token_idx").on(t.inviteToken),
  uniqueIndex("group_members_group_user_idx").on(t.groupId, t.userId),
  index("group_members_group_idx").on(t.groupId),
  index("group_members_user_idx").on(t.userId),
]);

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  modality: text("modality").notNull(),
  jsonSchema: jsonb("json_schema").notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex("templates_workspace_slug_idx").on(t.workspaceId, t.slug),
  index("templates_workspace_idx").on(t.workspaceId),
]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  templateId: uuid("template_id").notNull().references(() => templates.id),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  title: text("title").notNull(),
  status: text("status").notNull().default("uploaded"),
  storagePath: text("storage_path").notNull(),
  sourceUrl: text("source_url"),
  mimeType: text("mime_type").notNull(),
  pageCount: integer("page_count").notNull().default(1),
  tokenIn: integer("token_in").notNull().default(0),
  tokenOut: integer("token_out").notNull().default(0),
  error: text("error"),
  providerMode: text("provider_mode").notNull().default("fixture"),
  shareToken: text("share_token").notNull().default(sql`gen_random_uuid()::text`),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  paidByName: text("paid_by_name").notNull().default(""),
  ...timestamps,
}, (t) => [
  index("documents_workspace_status_idx").on(t.workspaceId, t.status),
  uniqueIndex("documents_share_token_idx").on(t.shareToken),
  index("documents_group_idx").on(t.groupId),
]);

export const groupStars = pgTable("group_stars", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.groupId] }),
  index("group_stars_group_idx").on(t.groupId),
]);

export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  fromName: text("from_name").notNull(),
  toName: text("to_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("settlements_group_idx").on(t.groupId),
  index("settlements_workspace_idx").on(t.workspaceId),
  index("settlements_created_by_idx").on(t.createdBy),
]);

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  detail: jsonb("detail").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("activity_events_group_created_idx").on(t.groupId, t.createdAt),
  index("activity_events_workspace_idx").on(t.workspaceId),
  index("activity_events_document_idx").on(t.documentId),
]);

export const documentPages = pgTable("document_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  pageIndex: integer("page_index").notNull(),
  imageUrl: text("image_url").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  ...timestamps,
}, (t) => [index("document_pages_document_idx").on(t.documentId)]);

export const fields = pgTable("fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  label: text("label").notNull(),
  modelValue: text("model_value"),
  humanValue: text("human_value"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  bounds: jsonb("bounds"),
  status: text("status").notNull().default("needs_review"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  ...timestamps,
}, (t) => [index("fields_document_idx").on(t.documentId)]);

export const splitClaims = pgTable("split_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  fieldId: uuid("field_id").notNull().references(() => fields.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").references(() => groupMembers.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  stance: text("stance").notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex("split_claims_doc_field_name_idx").on(t.documentId, t.fieldId, t.displayName),
  uniqueIndex("split_claims_doc_field_member_idx").on(t.documentId, t.fieldId, t.memberId),
  index("split_claims_document_idx").on(t.documentId),
  index("split_claims_field_idx").on(t.fieldId),
  index("split_claims_workspace_idx").on(t.workspaceId),
  index("split_claims_member_idx").on(t.memberId),
]);

export const precontextBlobs = pgTable("precontext_blobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  ...timestamps,
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  status: text("status").notNull().default("queued"),
  payload: jsonb("payload").notNull().default({}),
  attempts: integer("attempts").notNull().default(0),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lastError: text("last_error"),
  ...timestamps,
}, (t) => [
  index("jobs_queued_idx").on(t.status, t.createdAt),
]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  detail: jsonb("detail").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").references(() => documents.id),
  pages: integer("pages").notNull().default(1),
  tokenIn: integer("token_in").notNull().default(0),
  tokenOut: integer("token_out").notNull().default(0),
  stripeMeterId: text("stripe_meter_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("usage_workspace_idx").on(t.workspaceId)]);

export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

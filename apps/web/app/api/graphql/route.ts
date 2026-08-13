import SchemaBuilder from "@pothos/core";
import { eq } from "drizzle-orm";
import { createYoga } from "graphql-yoga";
import { documentPages, documents, fields, workspaces } from "@proofsheet/db";
import { decodeSession } from "@/lib/auth";
import { db } from "@/lib/db";

const builder = new SchemaBuilder<{
  Context: { userId?: string; workspaceId?: string };
}>({});

const FieldType = builder.objectRef<{
  id: string;
  key: string;
  label: string;
  modelValue: string | null;
  humanValue: string | null;
  confidence: string | null;
  status: string;
}>("Field");

FieldType.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    key: t.exposeString("key"),
    label: t.exposeString("label"),
    modelValue: t.exposeString("modelValue", { nullable: true }),
    humanValue: t.exposeString("humanValue", { nullable: true }),
    confidence: t.exposeString("confidence", { nullable: true }),
    status: t.exposeString("status"),
  }),
});

const PageType = builder.objectRef<{ imageUrl: string; width: number; height: number }>("Page");
PageType.implement({
  fields: (t) => ({
    imageUrl: t.exposeString("imageUrl"),
    width: t.exposeInt("width"),
    height: t.exposeInt("height"),
  }),
});

const DocumentType = builder.objectRef<{
  id: string;
  title: string;
  status: string;
  providerMode: string;
}>("Document");

DocumentType.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title"),
    status: t.exposeString("status"),
    providerMode: t.exposeString("providerMode"),
    fields: t.field({
      type: [FieldType],
      resolve: async (parent) => db().select().from(fields).where(eq(fields.documentId, parent.id)),
    }),
    pages: t.field({
      type: [PageType],
      resolve: async (parent) => db().select().from(documentPages).where(eq(documentPages.documentId, parent.id)),
    }),
  }),
});

const WorkspaceType = builder.objectRef<{
  id: string;
  name: string;
  confidenceThreshold: string;
  billingStatus: string;
}>("Workspace");

WorkspaceType.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    confidenceThreshold: t.exposeString("confidenceThreshold"),
    billingStatus: t.exposeString("billingStatus"),
  }),
});

builder.queryType({
  fields: (t) => ({
    workspace: t.field({
      type: WorkspaceType,
      nullable: true,
      resolve: async (_r, _a, ctx) => {
        if (!ctx.workspaceId) return null;
        const [row] = await db().select().from(workspaces).where(eq(workspaces.id, ctx.workspaceId)).limit(1);
        return row ?? null;
      },
    }),
    documents: t.field({
      type: [DocumentType],
      resolve: async (_r, _a, ctx) => {
        if (!ctx.workspaceId) return [];
        return db().select().from(documents).where(eq(documents.workspaceId, ctx.workspaceId));
      },
    }),
    document: t.field({
      type: DocumentType,
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_r, args, ctx) => {
        if (!ctx.workspaceId) return null;
        const [row] = await db().select().from(documents).where(eq(documents.id, String(args.id))).limit(1);
        if (!row || row.workspaceId !== ctx.workspaceId) return null;
        return row;
      },
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    reviewField: t.field({
      type: "Boolean",
      args: {
        documentId: t.arg.id({ required: true }),
        fieldId: t.arg.id({ required: true }),
        value: t.arg.string({ required: true }),
      },
      resolve: async (_r, args, ctx) => {
        if (!ctx.workspaceId || !ctx.userId) return false;
        const [field] = await db().select().from(fields).where(eq(fields.id, String(args.fieldId))).limit(1);
        if (!field || field.workspaceId !== ctx.workspaceId || field.documentId !== String(args.documentId)) {
          return false;
        }
        await db()
          .update(fields)
          .set({
            humanValue: args.value,
            reviewedBy: ctx.userId,
            status: "reviewed",
            updatedAt: new Date(),
          })
          .where(eq(fields.id, field.id));
        return true;
      },
    }),
    approveDocument: t.field({
      type: "Boolean",
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_r, args, ctx) => {
        if (!ctx.workspaceId) return false;
        const id = String(args.id);
        const [doc] = await db().select().from(documents).where(eq(documents.id, id)).limit(1);
        if (!doc || doc.workspaceId !== ctx.workspaceId) return false;
        const fieldRows = await db().select().from(fields).where(eq(fields.documentId, id));
        if (fieldRows.some((f) => f.status === "needs_review" && !f.humanValue)) return false;
        await db().update(documents).set({ status: "approved", updatedAt: new Date() }).where(eq(documents.id, id));
        return true;
      },
    }),
  }),
});

const schema = builder.toSchema();

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response, Request },
  context: ({ request }) => {
    const cookie = request.headers.get("cookie") ?? "";
    const match = cookie.match(/proofsheet_session=([^;]+)/);
    const session = decodeSession(match?.[1]);
    return {
      userId: session?.userId,
      workspaceId: session?.workspaceId,
    };
  },
});

export const runtime = "nodejs";

export function GET(request: Request) {
  return yoga.fetch(request);
}

export function POST(request: Request) {
  return yoga.fetch(request);
}

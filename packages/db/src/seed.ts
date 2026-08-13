import postgres from "postgres";
import { loadRootEnv } from "./load-env";

loadRootEnv();

const DEMO_USER_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_WORKSPACE_ID = "22222222-2222-2222-2222-222222222222";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });

await sql.unsafe(`
  insert into users (id, email, display_name)
  values ('${DEMO_USER_ID}', 'demo@proofsheet.dev', 'Demo reviewer')
  on conflict (email) do nothing;
`);

await sql.unsafe(`
  insert into workspaces (id, name, owner_id, confidence_threshold)
  values ('${DEMO_WORKSPACE_ID}', 'Vouch demo', '${DEMO_USER_ID}', 0.920)
  on conflict (id) do nothing;
`);

await sql.unsafe(`
  insert into memberships (workspace_id, user_id, role)
  values ('${DEMO_WORKSPACE_ID}', '${DEMO_USER_ID}', 'owner')
  on conflict (workspace_id, user_id) do nothing;
`);

const templates = [
  {
    slug: "grocery-receipt",
    name: "Grocery receipt",
    modality: "image",
    schema: {
      type: "object",
      properties: {
        merchant: { type: "string" },
        date: { type: "string" },
        total: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              price: { type: "string" },
            },
            required: ["name", "price"],
          },
        },
      },
      required: ["merchant", "date", "total", "items"],
    },
  },
  {
    slug: "payment-screenshot",
    name: "Payment screenshot",
    modality: "image",
    schema: {
      type: "object",
      properties: {
        sender: { type: "string" },
        recipient: { type: "string" },
        amount: { type: "string" },
        date: { type: "string" },
        status: { type: "string" },
        note: { type: "string" },
      },
      required: ["sender", "recipient", "amount", "date", "status"],
    },
  },
];

for (const t of templates) {
  await sql`
    insert into templates (workspace_id, slug, name, modality, json_schema)
    values (${DEMO_WORKSPACE_ID}, ${t.slug}, ${t.name}, ${t.modality}, ${sql.json(t.schema)})
    on conflict (workspace_id, slug) do update set
      name = excluded.name,
      json_schema = excluded.json_schema,
      updated_at = now();
  `;
}

await sql.end();
console.log("seeded demo user, workspace, templates");

export { DEMO_USER_ID, DEMO_WORKSPACE_ID };

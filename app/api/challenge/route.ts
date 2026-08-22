import { getD1 } from "../../../db";

const DEFAULT_START_DATE = "2026-08-24";
const categories = new Set(["Coding", "Math", "Physics", "Research", "Other"]);

type EntryPayload = {
  id?: string;
  player?: number;
  date?: string;
  category?: string;
  title?: string;
  notes?: string;
};

async function ensureSchema() {
  const d1 = getD1();
  await d1.batch([
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS challenge_settings (
        id INTEGER PRIMARY KEY,
        player_one TEXT NOT NULL,
        player_two TEXT NOT NULL,
        prize TEXT NOT NULL,
        start_date TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS assignments (
        id TEXT PRIMARY KEY,
        player INTEGER NOT NULL CHECK (player IN (0, 1)),
        assignment_date TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    d1.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS assignments_player_date_unique
      ON assignments(player, assignment_date)
    `),
    d1.prepare(`
      CREATE INDEX IF NOT EXISTS idx_assignments_date
      ON assignments(assignment_date)
    `),
  ]);

  await d1
    .prepare(`
      INSERT OR IGNORE INTO challenge_settings
        (id, player_one, player_two, prize, start_date)
      VALUES (1, ?, ?, ?, ?)
    `)
    .bind("Armon", "Victor", "Dinner", DEFAULT_START_DATE)
    .run();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected database error";
}

export async function GET() {
  try {
    await ensureSchema();
    const d1 = getD1();
    const [settingsResult, entriesResult] = await d1.batch([
      d1.prepare(`
        SELECT player_one, player_two, prize, start_date
        FROM challenge_settings WHERE id = 1
      `),
      d1.prepare(`
        SELECT id, player, assignment_date, category, title, notes
        FROM assignments
        ORDER BY assignment_date DESC, created_at DESC
      `),
    ]);

    const settings = settingsResult.results[0] as Record<string, unknown>;
    const entries = entriesResult.results.map((row) => ({
      id: String(row.id),
      player: Number(row.player),
      date: String(row.assignment_date),
      category: String(row.category),
      title: String(row.title),
      notes: String(row.notes),
    }));

    return Response.json({
      names: [String(settings.player_one), String(settings.player_two)],
      prize: String(settings.prize),
      startDate: String(settings.start_date),
      entries,
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as EntryPayload;
    const id = payload.id?.trim() ?? "";
    const player = payload.player;
    const date = payload.date?.trim() ?? "";
    const category = payload.category?.trim() ?? "";
    const title = payload.title?.trim() ?? "";
    const notes = payload.notes?.trim() ?? "";

    if (!id || (player !== 0 && player !== 1)) {
      return Response.json({ error: "A valid player and id are required." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < DEFAULT_START_DATE) {
      return Response.json({ error: "Assignment date is outside the challenge." }, { status: 400 });
    }
    if (!categories.has(category) || !title || title.length > 90 || notes.length > 220) {
      return Response.json({ error: "Assignment details are invalid." }, { status: 400 });
    }

    const result = await getD1()
      .prepare(`
        INSERT INTO assignments (id, player, assignment_date, category, title, notes)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id, player, assignment_date, category, title, notes
      `)
      .bind(id, player, date, category, title, notes)
      .first<Record<string, unknown>>();

    return Response.json({
      entry: {
        id: String(result?.id),
        player: Number(result?.player),
        date: String(result?.assignment_date),
        category: String(result?.category),
        title: String(result?.title),
        notes: String(result?.notes),
      },
    }, { status: 201 });
  } catch (error) {
    const message = errorMessage(error);
    const duplicate = message.includes("UNIQUE constraint failed");
    return Response.json(
      { error: duplicate ? "That player already logged this day." : message },
      { status: duplicate ? 409 : 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as { id?: string };
    const id = payload.id?.trim() ?? "";
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });

    await getD1().prepare("DELETE FROM assignments WHERE id = ?").bind(id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as { names?: string[]; prize?: string };
    const playerOne = payload.names?.[0]?.trim() ?? "";
    const playerTwo = payload.names?.[1]?.trim() ?? "";
    const prize = payload.prize?.trim() ?? "";
    if (!playerOne || !playerTwo || !prize || playerOne.length > 24 || playerTwo.length > 24 || prize.length > 40) {
      return Response.json({ error: "Player names and prize are required." }, { status: 400 });
    }

    await getD1()
      .prepare(`
        UPDATE challenge_settings
        SET player_one = ?, player_two = ?, prize = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `)
      .bind(playerOne, playerTwo, prize)
      .run();

    return Response.json({ names: [playerOne, playerTwo], prize });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

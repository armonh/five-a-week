import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const challengeSettings = sqliteTable("challenge_settings", {
  id: integer("id").primaryKey(),
  playerOne: text("player_one").notNull(),
  playerTwo: text("player_two").notNull(),
  prize: text("prize").notNull(),
  startDate: text("start_date").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const assignments = sqliteTable(
  "assignments",
  {
    id: text("id").primaryKey(),
    player: integer("player").notNull(),
    assignmentDate: text("assignment_date").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("assignments_player_date_unique").on(table.player, table.assignmentDate),
    index("idx_assignments_date").on(table.assignmentDate),
  ],
);

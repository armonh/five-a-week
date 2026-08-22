"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const TARGET = 5;
const DEFAULT_START_DATE = "2026-08-24";

type Player = 0 | 1;
type Category = "Coding" | "Math" | "Physics" | "Research" | "Other";

type Entry = {
  id: string;
  player: Player;
  date: string;
  category: Category;
  title: string;
  notes: string;
};

type ChallengeResponse = {
  names: [string, string];
  prize: string;
  startDate: string;
  entries: Entry[];
};

type Draft = {
  player: Player;
  date: string;
  category: Category;
  title: string;
  notes: string;
};

const categories: Category[] = ["Coding", "Math", "Physics", "Research", "Other"];

function startOfWeek(input: Date) {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function addDays(input: Date, amount: number) {
  const date = new Date(input);
  date.setDate(date.getDate() + amount);
  return date;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

function formatWeek(start: Date, end: Date) {
  const sameMonth = start.getMonth() === end.getMonth();
  const first = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(start);
  const last = new Intl.DateTimeFormat("en", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: "numeric",
  }).format(end);
  return `${first} – ${last}`;
}

function categoryClass(category: Category) {
  return `category category-${category.toLowerCase()}`;
}

function calculateStreakState(entries: Entry[], startDate: string, today: Date) {
  const firstWeek = startOfWeek(fromDateKey(startDate));
  const lastCompletedWeek = addDays(startOfWeek(today), -7);
  let week = firstWeek;
  let loser: Player | null = null;
  let winner: Player | null = null;
  let bothBroke = false;
  let resolvedWeek: string | null = null;
  const perfectWeeks: [number, number] = [0, 0];
  let completedWeeks = 0;

  while (week <= lastCompletedWeek) {
    const dates = Array.from({ length: 7 }, (_, index) => toDateKey(addDays(week, index)));
    const scores: [number, number] = [
      entries.filter((entry) => entry.player === 0 && dates.includes(entry.date)).length,
      entries.filter((entry) => entry.player === 1 && dates.includes(entry.date)).length,
    ];
    const completed: [boolean, boolean] = [scores[0] >= TARGET, scores[1] >= TARGET];
    completedWeeks += 1;

    if (completed[0]) perfectWeeks[0] += 1;
    if (completed[1]) perfectWeeks[1] += 1;

    if (completed[0] !== completed[1]) {
      loser = completed[0] ? 1 : 0;
      winner = completed[0] ? 0 : 1;
      resolvedWeek = toDateKey(week);
      break;
    }
    if (!completed[0] && !completed[1]) {
      bothBroke = true;
      resolvedWeek = toDateKey(week);
      break;
    }

    week = addDays(week, 7);
  }

  return { loser, winner, bothBroke, resolvedWeek, perfectWeeks, completedWeeks };
}

export default function Home() {
  const [names, setNames] = useState<[string, string]>(["Armon", "Victor"]);
  const [prize, setPrize] = useState("Dinner");
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [modal, setModal] = useState<"log" | "players" | null>(null);
  const [syncStatus, setSyncStatus] = useState<"loading" | "synced" | "saving" | "error">("loading");
  const [syncError, setSyncError] = useState("");

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const todayKey = toDateKey(today);
  const currentWeekStart = useMemo(
    () => startOfWeek(todayKey < startDate ? fromDateKey(startDate) : today),
    [startDate, today, todayKey],
  );
  const weekStart = useMemo(
    () => addDays(currentWeekStart, weekOffset * 7),
    [currentWeekStart, weekOffset],
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekKeys = useMemo(() => weekDays.map(toDateKey), [weekDays]);
  const weekEnd = weekDays[6];
  const weekEntries = entries.filter((entry) => weekKeys.includes(entry.date));
  const counts: [number, number] = [
    weekEntries.filter((entry) => entry.player === 0).length,
    weekEntries.filter((entry) => entry.player === 1).length,
  ];
  const streakState = useMemo(
    () => calculateStreakState(entries, startDate, today),
    [entries, startDate, today],
  );

  const [draft, setDraft] = useState<Draft>({
    player: 0,
    date: todayKey,
    category: "Coding",
    title: "",
    notes: "",
  });
  const [nameDrafts, setNameDrafts] = useState<[string, string]>(names);
  const [prizeDraft, setPrizeDraft] = useState(prize);

  useEffect(() => {
    let cancelled = false;

    async function loadChallenge(quiet = false) {
      if (!quiet) setSyncStatus("loading");
      try {
        const response = await fetch("/api/challenge", { cache: "no-store" });
        if (!response.ok) throw new Error("Shared tracker is temporarily unavailable.");
        const data = await response.json() as ChallengeResponse;
        if (!cancelled) {
          setNames(data.names);
          setPrize(data.prize);
          setStartDate(data.startDate);
          setEntries(data.entries);
          setSyncStatus("synced");
          setSyncError("");
        }
      } catch (error) {
        if (!cancelled) {
          setSyncStatus("error");
          setSyncError(error instanceof Error ? error.message : "Could not sync.");
        }
      }
    }

    void loadChallenge();
    const interval = window.setInterval(() => void loadChallenge(true), 10_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadChallenge(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!modal) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [modal]);

  const eligibleDates = (player: Player) =>
    weekKeys.filter(
      (date) =>
        date >= startDate &&
        date <= todayKey &&
        !weekEntries.some((entry) => entry.player === player && entry.date === date),
    );

  function openLog(player: Player = 0, preferredDate?: string) {
    const available = eligibleDates(player);
    const date = preferredDate && available.includes(preferredDate)
      ? preferredDate
      : available.includes(todayKey)
        ? todayKey
        : available[0] ?? "";
    setDraft({ player, date, category: "Coding", title: "", notes: "" });
    setModal("log");
  }

  function changeDraftPlayer(player: Player) {
    const available = eligibleDates(player);
    setDraft((current) => ({
      ...current,
      player,
      date: available.includes(current.date) ? current.date : available[0] ?? "",
    }));
  }

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.date || !draft.title.trim()) return;
    if (counts[draft.player] >= TARGET) return;
    const duplicate = entries.some(
      (entry) => entry.player === draft.player && entry.date === draft.date,
    );
    if (duplicate) return;
    const entry: Entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        player: draft.player,
        date: draft.date,
        category: draft.category,
        title: draft.title.trim(),
        notes: draft.notes.trim(),
    };

    setSyncStatus("saving");
    try {
      const response = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      const data = await response.json() as { entry?: Entry; error?: string };
      if (!response.ok || !data.entry) throw new Error(data.error || "Could not save assignment.");
      setEntries((current) => [...current, data.entry as Entry]);
      setSyncStatus("synced");
      setSyncError("");
      setModal(null);
    } catch (error) {
      setSyncStatus("error");
      setSyncError(error instanceof Error ? error.message : "Could not save assignment.");
    }
  }

  async function deleteEntry(id: string) {
    setSyncStatus("saving");
    try {
      const response = await fetch("/api/challenge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Could not remove assignment.");
      setEntries((current) => current.filter((entry) => entry.id !== id));
      setSyncStatus("synced");
      setSyncError("");
    } catch (error) {
      setSyncStatus("error");
      setSyncError(error instanceof Error ? error.message : "Could not remove assignment.");
    }
  }

  function openPlayers() {
    setNameDrafts(names);
    setPrizeDraft(prize);
    setModal("players");
  }

  async function savePlayers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextNames: [string, string] = [
      nameDrafts[0].trim() || "Player one",
      nameDrafts[1].trim() || "Player two",
    ];
    const nextPrize = prizeDraft.trim() || "Dinner";
    setSyncStatus("saving");
    try {
      const response = await fetch("/api/challenge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: nextNames, prize: nextPrize }),
      });
      if (!response.ok) throw new Error("Could not save matchup.");
      setNames(nextNames);
      setPrize(nextPrize);
      setSyncStatus("synced");
      setSyncError("");
      setModal(null);
    } catch (error) {
      setSyncStatus("error");
      setSyncError(error instanceof Error ? error.message : "Could not save matchup.");
    }
  }

  const scoreDifference = Math.abs(counts[0] - counts[1]);
  const statusText = todayKey < startDate && weekOffset === 0
    ? `Starts Monday. ${prize} is on the line.`
    : counts[0] === TARGET && counts[1] === TARGET
    ? "Both streaks survive this week."
    : counts[0] === TARGET || counts[1] === TARGET
      ? `${names[counts[0] === TARGET ? 0 : 1]} is safe. ${names[counts[0] === TARGET ? 1 : 0]} still needs ${TARGET - counts[counts[0] === TARGET ? 1 : 0]}.`
    : counts[0] === counts[1]
      ? counts[0] === 0
        ? "Fresh week. Five each keeps both streaks alive."
        : "Level this week. Both still need five."
      : `${names[counts[0] > counts[1] ? 0 : 1]} is ahead by ${scoreDifference}; both still need five.`;

  const dateContext = weekOffset === 0
    ? todayKey < startDate ? "Starts next week" : "This week"
    : weekOffset === -1
      ? "Last week"
      : weekOffset === 1
        ? "Next week"
        : weekOffset < 0
          ? `${Math.abs(weekOffset)} weeks ago`
          : `${weekOffset} weeks ahead`;

  const sortedEntries = [...weekEntries].sort((a, b) =>
    b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );
  const canLog = weekOffset <= 0 && (eligibleDates(0).length > 0 || eligibleDates(1).length > 0);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setWeekOffset(0)} aria-label="Go to this week">
          <span className="brand-mark">5</span>
          <span className="brand-word">FIVE/WEEK</span>
        </button>
        <div className="top-actions">
          <span className="prize-badge">Miss five, <strong>buy dinner</strong></span>
          <span className={`save-badge sync-${syncStatus}`} title={syncError || "Both devices share this data"}><span className="save-dot" />{syncStatus === "saving" ? "Saving…" : syncStatus === "error" ? "Sync issue" : syncStatus === "loading" ? "Connecting…" : "Live sync"}</span>
          <button className="text-button" type="button" onClick={openPlayers}>Edit players</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Weekly head-to-head</p>
            <h1>Five good problems.<br /><span>One week.</span></h1>
            <p className="hero-note">Five each week keeps the streak alive. Miss five by Sunday while the other finishes, and <strong>{prize.toLowerCase()} is on you.</strong></p>
          </div>
          <button className="primary-button hero-button" type="button" onClick={() => openLog()} disabled={!canLog}>
            <span>+</span> Log assignment
          </button>
        </section>

        <section className="week-toolbar" aria-label="Week navigation">
          <button className="icon-button" type="button" onClick={() => setWeekOffset((value) => value - 1)} aria-label="Previous week">←</button>
          <div className="week-label">
            <span>{dateContext}</span>
            <strong>{formatWeek(weekStart, weekEnd)}</strong>
          </div>
          <button className="icon-button" type="button" onClick={() => setWeekOffset((value) => value + 1)} aria-label="Next week">→</button>
          {weekOffset !== 0 && <button className="today-button" type="button" onClick={() => setWeekOffset(0)}>Today</button>}
        </section>

        <section className="scoreboard" aria-label="Weekly score">
          {[0, 1].map((playerIndex) => {
            const player = playerIndex as Player;
            const count = counts[player];
            const finished = count >= TARGET;
            return (
              <article className={`score-card player-${player + 1}`} key={player}>
                <div className="player-meta">
                  <div className="avatar">{initials(names[player])}</div>
                  <div>
                    <p>{player === 0 ? "Player one" : "Player two"}</p>
                    <h2>{names[player]}</h2>
                  </div>
                </div>
                <div className="score-row">
                  <div className="score-number"><strong>{count}</strong><span>/ {TARGET}</span></div>
                  <div className="progress-dots" aria-label={`${count} of ${TARGET} completed`}>
                    {Array.from({ length: TARGET }, (_, index) => (
                      <span className={index < count ? "done" : ""} key={index}>{index < count ? "✓" : index + 1}</span>
                    ))}
                  </div>
                </div>
                <div className="score-footer">
                  <span>{finished ? "Target complete" : `${TARGET - count} left this week`}</span>
                  <button
                    type="button"
                    onClick={() => openLog(player)}
                    disabled={finished || weekOffset > 0 || eligibleDates(player).length === 0 || syncStatus === "saving"}
                  >
                    {finished ? "Done" : "Add one +"}
                  </button>
                </div>
              </article>
            );
          })}
          <div className="versus-badge">VS</div>
          <div className="score-status"><span className="pulse" />{statusText}</div>
        </section>

        <section className={`streak-card ${streakState.loser !== null ? "dinner-owed" : ""}`} aria-label="Weekly completion streak">
          <div className="streak-copy">
            <p className="eyebrow">Streak watch</p>
            <h2>{streakState.loser !== null
              ? `${names[streakState.loser]} broke the streak`
              : streakState.bothBroke
                ? "Both streaks broke"
                : streakState.completedWeeks === 0
                  ? "No completed week yet"
                  : "Both streaks are alive"}</h2>
            <p>{streakState.loser !== null && streakState.winner !== null
              ? `${names[streakState.loser]} owes ${names[streakState.winner]} ${prize.toLowerCase()}.`
              : streakState.bothBroke
                ? "Both missed five in the same week, so there is no winner."
                : "Complete five by Sunday. The first person to miss while the other finishes loses."}</p>
          </div>
          <div className="streak-progress" aria-label={`${names[0]} ${streakState.perfectWeeks[0]} perfect weeks; ${names[1]} ${streakState.perfectWeeks[1]} perfect weeks`}>
            {([0, 1] as Player[]).map((player) => (
              <span className={streakState.loser === player ? "lost" : "alive"} key={player}>
                <strong>{streakState.perfectWeeks[player]}</strong>
                <em>{initials(names[player])} perfect weeks</em>
              </span>
            ))}
          </div>
        </section>

        <section className="board-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Daily board</p>
              <h2>One shot per day</h2>
            </div>
            <p>Each player can claim one square each day.</p>
          </div>

          <div className="day-grid">
            {weekDays.map((day) => {
              const key = toDateKey(day);
              const isToday = key === todayKey;
              const isFuture = key > todayKey;
              const isBeforeStart = key < startDate;
              return (
                <article className={`day-card ${isToday ? "is-today" : ""}`} key={key}>
                  <div className="day-heading">
                    <span>{new Intl.DateTimeFormat("en", { weekday: "short" }).format(day)}</span>
                    <strong>{day.getDate()}</strong>
                    {isToday && <em>Today</em>}
                  </div>
                  <div className="day-players">
                    {([0, 1] as Player[]).map((player) => {
                      const entry = weekEntries.find((item) => item.player === player && item.date === key);
                      return entry ? (
                        <button className={`day-entry day-entry-${player + 1}`} type="button" onClick={() => deleteEntry(entry.id)} title={`Remove ${entry.title}`} key={player}>
                          <span>{initials(names[player])}</span>
                          <b>✓</b>
                        </button>
                      ) : (
                        <button
                          className="day-empty"
                          type="button"
                          key={player}
                          onClick={() => openLog(player, key)}
                          disabled={isFuture || isBeforeStart || weekOffset > 0 || counts[player] >= TARGET || syncStatus === "saving"}
                          aria-label={`Log ${names[player]}'s assignment for ${key}`}
                        >
                          <span>{initials(names[player])}</span>
                          <b>{isFuture || isBeforeStart || weekOffset > 0 ? "·" : "+"}</b>
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
          <p className="remove-hint">Tip: click a completed square to remove it.</p>
        </section>

        <section className="lower-grid">
          <div className="activity-panel">
            <div className="section-heading compact-heading">
              <div>
                <p className="eyebrow">Text proof of work</p>
                <h2>Assignment log</h2>
              </div>
              <span>{sortedEntries.length} total</span>
            </div>

            {sortedEntries.length === 0 ? (
              <div className="empty-state">
                <span>01</span>
                <h3>Blank slate.</h3>
                <p>Finish a problem, proof, or research question. Then put it on the board.</p>
                <button type="button" onClick={() => openLog()} disabled={!canLog}>Log first assignment</button>
              </div>
            ) : (
              <div className="activity-list">
                {sortedEntries.map((entry) => (
                  <article className="activity-item" key={entry.id}>
                    <div className={`activity-avatar activity-avatar-${entry.player + 1}`}>{initials(names[entry.player])}</div>
                    <div className="activity-copy">
                      <div className="activity-topline">
                        <h3>{entry.title}</h3>
                        <span className={categoryClass(entry.category)}>{entry.category}</span>
                      </div>
                      <p>{names[entry.player]} · {new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(fromDateKey(entry.date))}</p>
                      {entry.notes && <small>{entry.notes}</small>}
                    </div>
                    <button className="delete-button" type="button" onClick={() => deleteEntry(entry.id)} aria-label={`Delete ${entry.title}`}>×</button>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="rules-card">
            <p className="eyebrow">The pact</p>
            <h2>Simple rules.<br />Honest work.</h2>
            <ol>
              <li><span>1</span><p><strong>Five per week</strong>Hit five before Sunday ends.</p></li>
              <li><span>2</span><p><strong>One per day</strong>No cramming five into Saturday.</p></li>
              <li><span>3</span><p><strong>Make it count</strong>Code, proofs, physics, research—your call.</p></li>
              <li><span>4</span><p><strong>Break the streak</strong>Miss five while the other finishes, then buy the winner dinner.</p></li>
            </ol>
            <div className="motto">Keep the streak. Miss five, buy {prize.toLowerCase()}.</div>
          </aside>
        </section>
      </main>

      <footer>
        <span>FIVE/WEEK</span>
        <p>Built for two people who keep their word.</p>
      </footer>

      {modal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setModal(null);
        }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="Close">×</button>

            {modal === "log" ? (
              <form onSubmit={addEntry}>
                <p className="eyebrow">Add text proof of work</p>
                <h2 id="modal-title">Log an assignment</h2>
                <p className="modal-intro">Add a title, category, and optional note. Logs do not contain images.</p>

                <fieldset className="player-picker">
                  <legend>Who did it?</legend>
                  {([0, 1] as Player[]).map((player) => (
                    <button className={draft.player === player ? `selected selected-${player + 1}` : ""} type="button" onClick={() => changeDraftPlayer(player)} key={player}>
                      <span>{initials(names[player])}</span>{names[player]}
                    </button>
                  ))}
                </fieldset>

                <div className="form-grid">
                  <label>
                    Day
                    <select value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} required>
                      {eligibleDates(draft.player).length === 0 && <option value="">No open days</option>}
                      {weekDays.map((day) => {
                        const key = toDateKey(day);
                        const used = weekEntries.some((entry) => entry.player === draft.player && entry.date === key);
                        const unavailable = used || key > todayKey || key < startDate || weekOffset > 0;
                        return <option value={key} disabled={unavailable} key={key}>{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(day)}{used ? " — used" : ""}</option>;
                      })}
                    </select>
                  </label>
                  <label>
                    Type
                    <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as Category }))}>
                      {categories.map((category) => <option key={category}>{category}</option>)}
                    </select>
                  </label>
                </div>

                <label>
                  What did you solve?
                  <input autoFocus value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Binary tree level order traversal" maxLength={90} required />
                </label>
                <label>
                  Short note <span>(optional)</span>
                  <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="What made it interesting or difficult?" rows={3} maxLength={220} />
                </label>
                {syncError && <p className="form-error" role="alert">{syncError}</p>}
                <button className="primary-button modal-submit" type="submit" disabled={!draft.date || !draft.title.trim() || counts[draft.player] >= TARGET || syncStatus === "saving"}>Claim the day <span>↗</span></button>
              </form>
            ) : (
              <form onSubmit={savePlayers}>
                <p className="eyebrow">Your matchup</p>
                <h2 id="modal-title">Matchup &amp; prize</h2>
                <p className="modal-intro">Names and stakes stay synced for both players.</p>
                <label>
                  Player one
                  <input autoFocus value={nameDrafts[0]} onChange={(event) => setNameDrafts([event.target.value, nameDrafts[1]])} maxLength={24} />
                </label>
                <label>
                  Player two
                  <input value={nameDrafts[1]} onChange={(event) => setNameDrafts([nameDrafts[0], event.target.value])} maxLength={24} />
                </label>
                <label>
                  Prize
                  <input value={prizeDraft} onChange={(event) => setPrizeDraft(event.target.value)} maxLength={40} />
                </label>
                {syncError && <p className="form-error" role="alert">{syncError}</p>}
                <button className="primary-button modal-submit" type="submit" disabled={syncStatus === "saving"}>Save matchup <span>↗</span></button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export type DiffLine = {
  id: string;
  type: "same" | "added" | "removed";
  text: string;
  oldLine?: number;
  newLine?: number;
};

export type DiffSide = {
  line?: number;
  text: string;
  type: DiffLine["type"] | "blank";
};

export type DiffRow = {
  id: string;
  before: DiffSide;
  after: DiffSide;
};

export function toLines(value: string) {
  return value ? value.split(/\r?\n/) : [];
}

export function lineDiff(previous: string, current: string): DiffLine[] {
  const previousLines = toLines(previous);
  const currentLines = toLines(current);
  const previousLength = previousLines.length;
  const currentLength = currentLines.length;
  const table = Array.from({ length: previousLength + 1 }, () =>
    Array.from({ length: currentLength + 1 }, () => 0),
  );
  const lines: DiffLine[] = [];

  for (let oldIndex = previousLength - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = currentLength - 1; newIndex >= 0; newIndex -= 1) {
      table[oldIndex][newIndex] =
        previousLines[oldIndex] === currentLines[newIndex]
          ? table[oldIndex + 1][newIndex + 1] + 1
          : Math.max(
              table[oldIndex + 1][newIndex],
              table[oldIndex][newIndex + 1],
            );
    }
  }

  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < previousLength || newIndex < currentLength) {
    if (
      oldIndex < previousLength &&
      newIndex < currentLength &&
      previousLines[oldIndex] === currentLines[newIndex]
    ) {
      lines.push({
        id: `same-${oldIndex}-${newIndex}`,
        type: "same",
        text: previousLines[oldIndex],
        oldLine: oldIndex + 1,
        newLine: newIndex + 1,
      });
      oldIndex += 1;
      newIndex += 1;
      continue;
    }

    if (
      newIndex >= currentLength ||
      (oldIndex < previousLength &&
        table[oldIndex + 1][newIndex] >= table[oldIndex][newIndex + 1])
    ) {
      lines.push({
        id: `removed-${oldIndex}-${newIndex}`,
        type: "removed",
        text: previousLines[oldIndex],
        oldLine: oldIndex + 1,
      });
      oldIndex += 1;
      continue;
    }

    lines.push({
      id: `added-${oldIndex}-${newIndex}`,
      type: "added",
      text: currentLines[newIndex],
      newLine: newIndex + 1,
    });
    newIndex += 1;
  }

  return lines;
}

function blankSide(): DiffSide {
  return {
    text: "",
    type: "blank",
  };
}

export function buildSideBySideRows(diff: DiffLine[]) {
  const rows: DiffRow[] = [];
  let index = 0;

  while (index < diff.length) {
    const line = diff[index];

    if (line.type === "same") {
      rows.push({
        id: line.id,
        before: {
          line: line.oldLine,
          text: line.text,
          type: "same",
        },
        after: {
          line: line.newLine,
          text: line.text,
          type: "same",
        },
      });
      index += 1;
      continue;
    }

    const removedLines: DiffLine[] = [];
    const addedLines: DiffLine[] = [];

    while (diff[index]?.type === "removed") {
      removedLines.push(diff[index]);
      index += 1;
    }

    while (diff[index]?.type === "added") {
      addedLines.push(diff[index]);
      index += 1;
    }

    const rowCount = Math.max(removedLines.length, addedLines.length);

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const removed = removedLines[rowIndex];
      const added = addedLines[rowIndex];

      rows.push({
        id: `changed-${removed?.id ?? "none"}-${added?.id ?? "none"}`,
        before: removed
          ? {
              line: removed.oldLine,
              text: removed.text,
              type: "removed",
            }
          : blankSide(),
        after: added
          ? {
              line: added.newLine,
              text: added.text,
              type: "added",
            }
          : blankSide(),
      });
    }
  }

  return rows;
}

export function diffStats(diff: DiffLine[]) {
  return diff.reduce(
    (stats, line) => ({
      added: stats.added + (line.type === "added" ? 1 : 0),
      removed: stats.removed + (line.type === "removed" ? 1 : 0),
    }),
    { added: 0, removed: 0 },
  );
}

export type ScoreLine = {
  skillName: string;
  rating: string;
};

export type CommentDraft = {
  draft: string;
  source: 'model' | 'rules';
};

const RATING_RANK: Record<string, number> = {
  LEARNING: 1,
  AVERAGE: 2,
  GOOD: 3,
  EXCELLENT: 4,
};

function label(rating: string): string {
  if (rating === 'LEARNING') return 'still learning';
  if (rating === 'AVERAGE') return 'average';
  if (rating === 'GOOD') return 'good';
  if (rating === 'EXCELLENT') return 'excellent';
  return rating.toLowerCase();
}

/** Draft from the ratings on the form. Used when no model key is configured. */
export function draftCommentFromRatings(studentName: string, scores: ScoreLine[]): string {
  const name = studentName.trim() || 'This student';
  const ranked = scores
    .map((score) => ({
      ...score,
      rank: RATING_RANK[score.rating] ?? 0,
    }))
    .filter((score) => score.skillName.trim().length > 0);

  const strengths = ranked.filter((score) => score.rank >= 3).map((score) => score.skillName);
  const learning = ranked.filter((score) => score.rank > 0 && score.rank <= 2);

  const parts: string[] = [];
  if (strengths.length > 0) {
    parts.push(`${name} is solid on ${strengths.slice(0, 4).join(', ')}.`);
  }
  if (learning.length > 0) {
    const detail = learning
      .slice(0, 3)
      .map((score) => `${score.skillName} (${label(score.rating)})`)
      .join(', ');
    parts.push(`Keep working on ${detail}.`);
  }

  if (parts.length === 0) {
    return `${name} was assessed today. Add ratings, then draft the note again.`;
  }

  const focus = learning[0]?.skillName ?? strengths[0];
  parts.push(`Next session, spend extra time on ${focus}.`);
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}

export async function generateCommentDraft(
  studentName: string,
  scores: ScoreLine[],
): Promise<CommentDraft> {
  const fallback = draftCommentFromRatings(studentName, scores);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { draft: fallback, source: 'rules' };
  }

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const lines = scores
    .filter((score) => score.skillName && score.rating)
    .map((score) => `- ${score.skillName}: ${score.rating}`)
    .join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 180,
        messages: [
          {
            role: 'system',
            content:
              'You write a short gymnastics coach comment. Use only the ratings given. Do not invent injuries, medals, or attendance. Maximum 80 words. Plain sentences.',
          },
          {
            role: 'user',
            content: `Student: ${studentName}\nRatings:\n${lines}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return { draft: fallback, source: 'rules' };
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { draft: fallback, source: 'rules' };
    }
    return { draft: text.slice(0, 500), source: 'model' };
  } catch {
    return { draft: fallback, source: 'rules' };
  }
}

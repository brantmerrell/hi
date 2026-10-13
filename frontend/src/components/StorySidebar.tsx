import { useState } from "react";
import { Link } from "react-router-dom";
import type { Story } from "../types";

interface Props {
  stories: Story[];
  currentStory: Story | null;
  currentChapterId?: string;
}

interface AuthorGroup {
  slug: string;
  name: string;
  stories: Story[];
}

function groupByAuthor(stories: Story[]): AuthorGroup[] {
  const groups = new Map<string, AuthorGroup>();
  for (const story of stories) {
    const group = groups.get(story.author_slug) ?? {
      slug: story.author_slug,
      name: story.author,
      stories: [],
    };
    group.stories.push(story);
    groups.set(story.author_slug, group);
  }
  return [...groups.values()];
}

export default function StorySidebar({ stories, currentStory, currentChapterId }: Props) {
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const currentSlug = currentStory?.author_slug;

  // The current author is open by default; toggling flips that default.
  function isOpen(slug: string) {
    return (slug === currentSlug) !== toggled.has(slug);
  }

  function toggle(slug: string) {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <nav className="menu" aria-label="Authors and stories">
      <p className="menu-label">Authors</p>
      <ul className="menu-list">
        {groupByAuthor(stories).map((group) => {
          const open = isOpen(group.slug);
          return (
            <li key={group.slug}>
              <a
                role="button"
                aria-expanded={open}
                className={group.slug === currentSlug ? "is-active" : undefined}
                onClick={() => toggle(group.slug)}
              >
                {open ? "▾" : "▸"} {group.name}
              </a>
              {open && (
                <ul>
                  {group.stories.map((story) => (
                    <li key={story.id}>
                      <Link
                        to={`/${story.author_slug}/${story.position ?? 0}`}
                        className={story.id === currentStory?.id ? "is-active" : undefined}
                      >
                        <span className="devanagari">{story.title_hi}</span>
                        {story.title_en && (
                          <span className="is-size-7 has-text-grey-light is-block">{story.title_en}</span>
                        )}
                      </Link>
                      {story.id === currentStory?.id && story.chapters.length > 1 && (
                        <ul>
                          {story.chapters.map((chapter) => (
                            <li key={chapter.id}>
                              <Link
                                to={`/${story.author_slug}/${story.position ?? 0}/${chapter.position}`}
                                className={chapter.id === currentChapterId ? "is-active" : undefined}
                              >
                                <span className="devanagari">
                                  {chapter.title_hi ?? chapter.title_en ?? `Chapter ${chapter.position}`}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

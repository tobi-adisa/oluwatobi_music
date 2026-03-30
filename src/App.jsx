import { useEffect, useMemo, useState } from "react";

const emptyRelease = () => ({
  id: `release-${crypto.randomUUID()}`,
  title: "",
  subtitle: "",
  type: "single",
  releaseDate: "",
  description: "",
  imageUrl: "",
  spotifyUrl: "",
  bandcampEmbedSrc: "",
  links: [],
});

const emptySocial = () => ({
  id: `social-${crypto.randomUUID()}`,
  label: "",
  url: "",
});

const emptyLink = () => ({
  id: `link-${crypto.randomUUID()}`,
  platform: "",
  label: "",
  url: "",
});

function normalizeLink(link, index) {
  return {
    id: link.id || `link-${index}-${crypto.randomUUID()}`,
    platform: link.platform || "",
    label: link.label || "",
    url: link.url || "",
  };
}

function normalizeSpotifyUrl(url) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url.trim());
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

function normalizeRelease(release, index) {
  return {
    ...emptyRelease(),
    ...release,
    id: release.id || `release-${index}-${crypto.randomUUID()}`,
    spotifyUrl: normalizeSpotifyUrl(release.spotifyUrl || ""),
    links: (release.links || []).map(normalizeLink),
  };
}

function normalizeContentShape(value) {
  const source = value || {};
  return {
    ...source,
    artist: {
      name: "",
      badge: "",
      tagline: "",
      heroHeading: "",
      heroSubheading: "",
      aboutHeading: "",
      aboutBody: "",
      contactEmail: "",
      ...(source.artist || {}),
    },
    socials: (source.socials || []).map((social, index) => ({
      ...emptySocial(),
      ...social,
      id: social.id || `social-${index}-${crypto.randomUUID()}`,
    })),
    releases: (source.releases || []).map(normalizeRelease),
  };
}

function sortReleases(releases) {
  return [...releases].sort((a, b) => {
    const left = a.releaseDate || "";
    const right = b.releaseDate || "";
    return right.localeCompare(left);
  });
}

function mergeLinks(existingLinks = [], incomingLinks = []) {
  const map = new Map();

  [...existingLinks, ...incomingLinks].forEach((link, index) => {
    if (!link?.url) {
      return;
    }

    const normalized = normalizeLink(link, index);
    const normalizedUrl =
      normalized.platform === "spotify" ? normalizeSpotifyUrl(normalized.url) : normalized.url;
    const key = `${normalized.platform || normalized.label}-${normalizedUrl}`;
    map.set(key, normalized);
  });

  return [...map.values()];
}

function countResolvedLinks(links = []) {
  return links.filter((link) => link?.url).length;
}

function normalizeBandcampEmbed(value) {
  if (!value) {
    return "";
  }

  const srcMatch = value.match(/src="([^"]+)"/i);
  return srcMatch ? srcMatch[1] : value.trim();
}

function streamingPriority(link) {
  const order = [
    "spotify",
    "appleMusic",
    "youtubeMusic",
    "bandcamp",
    "soundcloud",
    "deezer",
    "tidal",
    "amazonMusic",
    "youtube",
  ];
  const index = order.indexOf(link.platform);
  return index === -1 ? order.length + 1 : index;
}

function App() {
  const [content, setContent] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(window.location.hash === "#admin" ? "admin" : "site");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminToken, setAdminToken] = useState(localStorage.getItem("adminToken") || "");
  const [defaultPassword, setDefaultPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onHashChange = () => {
      setMode(window.location.hash === "#admin" ? "admin" : "site");
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    async function loadPublicContent() {
      setLoading(true);
      const [contentResponse, statusResponse] = await Promise.all([
        fetch("/api/content"),
        fetch("/api/admin/status"),
      ]);
      const [contentPayload, statusPayload] = await Promise.all([
        contentResponse.json(),
        statusResponse.json(),
      ]);
      const normalized = normalizeContentShape(contentPayload);
      setContent(normalized);
      setDraft(normalized);
      setDefaultPassword(Boolean(statusPayload.defaultPassword));
      setLoading(false);
    }

    loadPublicContent().catch(() => {
      setMessage("Could not load content.");
      setLoading(false);
    });
  }, []);

  const releases = useMemo(() => sortReleases(content?.releases || []), [content]);

  async function loginAdmin(event) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: adminPassword }),
    });

    if (!response.ok) {
      setMessage("Incorrect admin password.");
      return;
    }

    const payload = await response.json();
    localStorage.setItem("adminToken", payload.token);
    setAdminToken(payload.token);
    setAdminPassword("");
    setMessage("Admin unlocked.");
  }

  function updateArtistField(field, value) {
    setDraft((current) => ({
      ...current,
      artist: {
        ...current.artist,
        [field]: value,
      },
    }));
  }

  function updateRelease(id, field, value) {
    setDraft((current) => ({
      ...current,
      releases: current.releases.map((release) =>
        release.id === id ? { ...release, [field]: value } : release
      ),
    }));
  }

  function updateSocial(id, field, value) {
    setDraft((current) => ({
      ...current,
      socials: current.socials.map((social) =>
        social.id === id ? { ...social, [field]: value } : social
      ),
    }));
  }

  function updateReleaseLink(releaseId, linkId, field, value) {
    setDraft((current) => ({
      ...current,
      releases: current.releases.map((release) =>
        release.id === releaseId
          ? {
              ...release,
              links: release.links.map((link) =>
                link.id === linkId ? { ...link, [field]: value } : link
              ),
            }
          : release
      ),
    }));
  }

  async function saveDraft() {
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draft),
    });

    if (!response.ok) {
      setSaving(false);
      setMessage("Could not save changes.");
      return;
    }

    const payload = await response.json();
    const normalized = normalizeContentShape(payload.content);
    setContent(normalized);
    setDraft(normalized);
    setSaving(false);
    setMessage("Changes saved.");
  }

  async function autoFillRelease(id, forceRefresh = false) {
    const release = draft.releases.find((item) => item.id === id);
    if (!release?.spotifyUrl) {
      setMessage("Add a Spotify URL first.");
      return;
    }

    setMessage(forceRefresh ? "Refreshing streaming links..." : "Fetching streaming links and artwork...");
    const response = await fetch("/api/admin/releases/resolve", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        spotifyUrl: normalizeSpotifyUrl(release.spotifyUrl),
        forceRefresh,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Lookup failed." }));
      setMessage(payload.error || "Lookup failed.");
      return;
    }

    const payload = await response.json();
    setDraft((current) => ({
      ...current,
      releases: current.releases.map((item) =>
        item.id === id
          ? {
              ...item,
              ...payload.release,
              bandcampEmbedSrc: item.bandcampEmbedSrc,
              links: mergeLinks(item.links, payload.release.links),
            }
          : item
      ),
    }));
    setMessage(payload.message || "Release details filled from Spotify.");
  }

  async function refreshMissingLinks() {
    const missing = draft.releases.filter(
      (release) => release.spotifyUrl && countResolvedLinks(release.links) <= 1
    );

    if (missing.length === 0) {
      setMessage("Every release already has more than one streaming link.");
      return;
    }

    for (const release of missing) {
      await autoFillRelease(release.id, true);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "site-content.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const raw = await file.text();
    const parsed = JSON.parse(raw);
    setDraft(normalizeContentShape(parsed));
    setMessage("Imported JSON into the editor. Save when ready.");
  }

  if (loading || !content || !draft) {
    return <div className="loading-shell">Loading site...</div>;
  }

  return (
    <div className="app-shell">
      <BackgroundTriangles />
      <header className="topbar">
        <a className="brand-mark" href="#site" onClick={() => (window.location.hash = "")}>
          <span>{content.artist.name}</span>
        </a>
        <nav className="topbar-links">
          <a href="#site">Site</a>
          <a href="#releases">Releases</a>
          <a href="#about">About</a>
          <a href="#admin">Admin</a>
        </nav>
      </header>

      {mode === "admin" ? (
        <AdminView
          adminPassword={adminPassword}
          adminToken={adminToken}
          defaultPassword={defaultPassword}
          draft={draft}
          message={message}
          onAddRelease={() =>
            setDraft((current) => ({
              ...current,
              releases: [emptyRelease(), ...current.releases],
            }))
          }
          onAddSocial={() =>
            setDraft((current) => ({
              ...current,
              socials: [...current.socials, emptySocial()],
            }))
          }
          onAutoFillRelease={autoFillRelease}
          onChangeAdminPassword={setAdminPassword}
          onExport={exportJson}
          onImport={importJson}
          onLogin={loginAdmin}
          onRefreshMissingLinks={refreshMissingLinks}
          onRemoveRelease={(id) =>
            setDraft((current) => ({
              ...current,
              releases: current.releases.filter((release) => release.id !== id),
            }))
          }
          onAddReleaseLink={(releaseId) =>
            setDraft((current) => ({
              ...current,
              releases: current.releases.map((release) =>
                release.id === releaseId
                  ? { ...release, links: [...release.links, emptyLink()] }
                  : release
              ),
            }))
          }
          onRemoveReleaseLink={(releaseId, linkId) =>
            setDraft((current) => ({
              ...current,
              releases: current.releases.map((release) =>
                release.id === releaseId
                  ? {
                      ...release,
                      links: release.links.filter((link) => link.id !== linkId),
                    }
                  : release
              ),
            }))
          }
          onRemoveSocial={(id) =>
            setDraft((current) => ({
              ...current,
              socials: current.socials.filter((social) => social.id !== id),
            }))
          }
          onSave={saveDraft}
          onSetFeaturedQuote={(value) =>
            setDraft((current) => ({ ...current, featuredQuote: value }))
          }
          onUpdateArtistField={updateArtistField}
          onUpdateReleaseLink={updateReleaseLink}
          onUpdateRelease={updateRelease}
          onUpdateSocial={updateSocial}
          saving={saving}
        />
      ) : (
        <SiteView content={content} releases={releases} />
      )}
    </div>
  );
}

function SiteView({ content, releases }) {
  const [heroProgress, setHeroProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    function updateProgress() {
      const distance = Math.max(window.innerHeight * 0.72, 1);
      const next = Math.min(window.scrollY / distance, 1);
      setHeroProgress(next);
      frame = 0;
    }

    function onScroll() {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(updateProgress);
    }

    updateProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <main className="site-view">
      <section className="hero-logo-section" id="site">
        <div
          className="hero-logo-frame"
          style={{
            opacity: 1 - heroProgress * 1.15,
            transform: `translate3d(0, ${heroProgress * -48}px, 0) scale(${1 - heroProgress * 0.28})`,
            filter: `blur(${heroProgress * 6}px)`,
          }}
        >
          <div className="artist-wordmark" aria-label="OLUWATOBI">
            <span>OLUW</span>
            <span className="triangle-letter" aria-hidden="true" />
            <span>TOBI</span>
          </div>
          <p className="hero-scroll-label">{content.artist.badge}</p>
        </div>
      </section>

      <section className="quote-banner">
        <p>{content.featuredQuote}</p>
      </section>

      <section className="social-strip">
        {content.socials.map((social) => (
          <a key={social.id} href={social.url} target="_blank" rel="noreferrer">
            {social.label}
          </a>
        ))}
      </section>

      <section className="releases-section" id="releases">
        <div className="section-heading">
          <p className="eyebrow">Music</p>
          <h2>Releases</h2>
        </div>
        <div className="release-grid">
          {releases.map((release) => (
            <article className="release-card" key={release.id}>
              <div className="release-art-shell">
                <img alt={release.title} src={release.imageUrl} />
                <span className="release-type">{release.type}</span>
              </div>
              <div className="release-body">
                <p className="release-date">{release.releaseDate || "Coming soon"}</p>
                <h3>{release.title}</h3>
                <p className="release-subtitle">{release.subtitle}</p>
                <p className="release-description">{release.description}</p>
                <div className="stream-links">
                  {sortLinks(release.links).map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="stream-link-kicker">Stream</span>
                      <span className="stream-link-label">{link.label}</span>
                    </a>
                  ))}
                </div>
                {release.bandcampEmbedSrc ? (
                  <div className="bandcamp-shell">
                    <iframe
                      src={release.bandcampEmbedSrc}
                      title={`${release.title} on Bandcamp`}
                      seamless
                    />
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section" id="about">
        <div className="section-heading">
          <p className="eyebrow">Story</p>
          <h2>{content.artist.aboutHeading}</h2>
        </div>
        <div className="about-copy">
          <p>{content.artist.aboutBody}</p>
          <p className="signature-line">{content.artist.tagline}</p>
        </div>
      </section>
    </main>
  );
}

function AdminView({
  adminPassword,
  adminToken,
  defaultPassword,
  draft,
  message,
  onAddRelease,
  onAddSocial,
  onAutoFillRelease,
  onChangeAdminPassword,
  onExport,
  onImport,
  onAddReleaseLink,
  onLogin,
  onRefreshMissingLinks,
  onRemoveRelease,
  onRemoveReleaseLink,
  onRemoveSocial,
  onSave,
  onSetFeaturedQuote,
  onUpdateArtistField,
  onUpdateReleaseLink,
  onUpdateRelease,
  onUpdateSocial,
  saving,
}) {
  if (!adminToken) {
    return (
      <main className="admin-shell">
        <section className="admin-login-card">
          <p className="eyebrow">Admin</p>
          <h1>Manage your artist site</h1>
          <p>
            Unlock the editor to update copy, social links, and release cards. New Spotify
            URLs can auto-fill artwork and streaming destinations.
          </p>
          {defaultPassword ? (
            <p className="warning-banner">
              You are using the default admin password. Update `ADMIN_PASSWORD` before going
              live.
            </p>
          ) : null}
          <form className="admin-login-form" onSubmit={onLogin}>
            <input
              type="password"
              placeholder="Admin password"
              value={adminPassword}
              onChange={(event) => onChangeAdminPassword(event.target.value)}
            />
            <button type="submit">Unlock admin</button>
          </form>
          {message ? <p className="status-line">{message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <section className="admin-header">
        <div>
          <p className="eyebrow">Editor</p>
          <h1>Artist admin view</h1>
          <p>Everything here saves into the site data file on the server.</p>
        </div>
        <div className="admin-actions">
          <button type="button" className="ghost-button" onClick={onExport}>
            Export JSON
          </button>
          <label className="ghost-button file-button">
            Import JSON
            <input type="file" accept="application/json" onChange={onImport} />
          </label>
          <button type="button" className="primary-button" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </section>

      {message ? <p className="status-line">{message}</p> : null}

      <section className="admin-grid">
        <div className="admin-card">
          <h2>Site copy</h2>
          <AdminField
            label="Artist name"
            value={draft.artist.name}
            onChange={(value) => onUpdateArtistField("name", value)}
          />
          <AdminField
            label="Badge"
            value={draft.artist.badge}
            onChange={(value) => onUpdateArtistField("badge", value)}
          />
          <AdminField
            label="Tagline"
            value={draft.artist.tagline}
            onChange={(value) => onUpdateArtistField("tagline", value)}
          />
          <AdminField
            label="Hero heading"
            value={draft.artist.heroHeading}
            onChange={(value) => onUpdateArtistField("heroHeading", value)}
          />
          <AdminTextArea
            label="Hero subheading"
            value={draft.artist.heroSubheading}
            onChange={(value) => onUpdateArtistField("heroSubheading", value)}
          />
          <AdminField
            label="About heading"
            value={draft.artist.aboutHeading}
            onChange={(value) => onUpdateArtistField("aboutHeading", value)}
          />
          <AdminTextArea
            label="About body"
            value={draft.artist.aboutBody}
            onChange={(value) => onUpdateArtistField("aboutBody", value)}
          />
          <AdminField
            label="Contact email"
            value={draft.artist.contactEmail}
            onChange={(value) => onUpdateArtistField("contactEmail", value)}
          />
          <AdminTextArea
            label="Featured quote"
            value={draft.featuredQuote}
            onChange={onSetFeaturedQuote}
          />
        </div>

        <div className="admin-card">
          <div className="card-header-inline">
            <h2>Social links</h2>
            <button type="button" className="ghost-button" onClick={onAddSocial}>
              Add social
            </button>
          </div>
          {draft.socials.map((social) => (
            <div className="mini-card" key={social.id}>
              <AdminField
                label="Label"
                value={social.label}
                onChange={(value) => onUpdateSocial(social.id, "label", value)}
              />
              <AdminField
                label="URL"
                value={social.url}
                onChange={(value) => onUpdateSocial(social.id, "url", value)}
              />
              <button type="button" className="text-button" onClick={() => onRemoveSocial(social.id)}>
                Remove social
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card release-editor">
        <div className="card-header-inline">
          <div>
            <h2>Releases</h2>
            <p>Add singles, EPs, or albums. Paste a Spotify URL and auto-fill the rest.</p>
          </div>
          <div className="release-header-actions">
            <button type="button" className="ghost-button" onClick={onRefreshMissingLinks}>
              Refresh missing links
            </button>
            <button type="button" className="primary-button" onClick={onAddRelease}>
              Add release
            </button>
          </div>
        </div>

        {draft.releases.map((release) => (
          <div className="release-form-card" key={release.id}>
            <div className="release-form-header">
              <h3>{release.title || "Untitled release"}</h3>
              <button type="button" className="text-button" onClick={() => onRemoveRelease(release.id)}>
                Remove
              </button>
            </div>
            <div className="admin-form-grid">
              <AdminField
                label="Title"
                value={release.title}
                onChange={(value) => onUpdateRelease(release.id, "title", value)}
              />
              <AdminField
                label="Subtitle"
                value={release.subtitle}
                onChange={(value) => onUpdateRelease(release.id, "subtitle", value)}
              />
              <AdminSelect
                label="Type"
                value={release.type}
                options={[
                  { label: "Single", value: "single" },
                  { label: "Album", value: "album" },
                  { label: "EP", value: "ep" },
                  { label: "Release", value: "release" },
                ]}
                onChange={(value) => onUpdateRelease(release.id, "type", value)}
              />
              <AdminField
                label="Release date"
                type="date"
                value={release.releaseDate}
                onChange={(value) => onUpdateRelease(release.id, "releaseDate", value)}
              />
              <div className="spotify-field">
                <AdminField
                  label="Spotify URL"
                  value={release.spotifyUrl}
                  onChange={(value) => onUpdateRelease(release.id, "spotifyUrl", value)}
                />
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onAutoFillRelease(release.id, true)}
                >
                  Auto-fill / refresh links
                </button>
              </div>
              <AdminField
                label="Artwork URL"
                value={release.imageUrl}
                onChange={(value) => onUpdateRelease(release.id, "imageUrl", value)}
              />
            </div>
            <AdminTextArea
              label="Description"
              value={release.description}
              onChange={(value) => onUpdateRelease(release.id, "description", value)}
            />
            <AdminTextArea
              label="Bandcamp embed URL or iframe code"
              value={release.bandcampEmbedSrc}
              onChange={(value) =>
                onUpdateRelease(release.id, "bandcampEmbedSrc", normalizeBandcampEmbed(value))
              }
            />
            <div className="release-links-editor">
              <div className="card-header-inline">
                <h4>Streaming links</h4>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onAddReleaseLink(release.id)}
                >
                  Add link
                </button>
              </div>
              {sortLinks(release.links).map((link) => (
                <div className="admin-form-grid compact" key={link.id}>
                  <AdminField
                    label="Platform"
                    value={link.platform}
                    onChange={(value) => onUpdateReleaseLink(release.id, link.id, "platform", value)}
                  />
                  <AdminField
                    label="Label"
                    value={link.label}
                    onChange={(value) => onUpdateReleaseLink(release.id, link.id, "label", value)}
                  />
                  <AdminField
                    label="URL"
                    value={link.url}
                    onChange={(value) => onUpdateReleaseLink(release.id, link.id, "url", value)}
                  />
                  <button
                    type="button"
                    className="text-button align-end"
                    onClick={() => onRemoveReleaseLink(release.id, link.id)}
                  >
                    Remove link
                  </button>
                </div>
              ))}
            </div>
            <div className="link-pill-list">
              {sortLinks(release.links).map((link) => (
                <span key={link.id} className="link-pill">
                  {link.label || link.platform || "Link"}
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function AdminField({ label, onChange, type = "text", value }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function AdminTextArea({ label, onChange, value }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <textarea rows="4" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function AdminSelect({ label, onChange, options, value }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function BackgroundTriangles() {
  return (
    <div className="background-triangles" aria-hidden="true">
      <div className="bg-triangle a" />
      <div className="bg-triangle b" />
      <div className="bg-triangle c" />
      <div className="grid-sheen" />
    </div>
  );
}

function sortLinks(links = []) {
  return [...links]
    .filter((link) => link?.url)
    .sort((a, b) => streamingPriority(a) - streamingPriority(b));
}

export default App;

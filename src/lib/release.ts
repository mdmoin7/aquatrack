export interface AppRelease {
  version: string
  buildTime: string
  commit: string
}

export function getAppRelease(): AppRelease {
  return {
    version: __APP_VERSION__,
    buildTime: __BUILD_TIME__,
    commit: __GIT_COMMIT__,
  }
}

export function formatReleaseDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatReleaseLabel(release: AppRelease): string {
  return `v${release.version} · ${formatReleaseDate(release.buildTime)}`
}

export function formatReleaseSummary(release: AppRelease): string {
  const parts = [`v${release.version}`, formatReleaseDate(release.buildTime)]
  if (release.commit && release.commit !== 'local') {
    parts.push(release.commit)
  }
  return parts.join(' · ')
}

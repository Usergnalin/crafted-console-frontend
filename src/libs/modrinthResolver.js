const API_BASE = 'https://api.modrinth.com/v2'

const FABRIC_API_PROJECT_ID = 'P7dR8mSH'

/**
 * Resolve dependencies for a mod installation
 * @param {string} targetProjectId - Project ID to install
 * @param {string} targetVersionId - Version ID to install (can be null to find best)
 * @param {Array} installedMods - Already installed mods (from SSE)
 * @param {string} gameVersion - Minecraft version (e.g., "1.21.11")
 * @param {string} loader - Loader type (e.g., "fabric")
 * @returns {Promise<Object>} Resolution result with to_install and warnings
 */
export async function resolveDependencies(targetProjectId, targetVersionId, installedMods, gameVersion, loader) {
  const result = {
    to_install: {}, // project_id -> version_id
    warnings: [],
    titles: {}, // project_id -> project title
    modules: [], // Full module info for install command
  };

  const visitedProjects = new Set();
  const installedProjectIds = new Set(installedMods.map(m => m.module_metadata.project_id).filter(Boolean));

  async function fetchVersionDetails(versionId) {
    const res = await fetch(`${API_BASE}/version/${versionId}`);
    if (!res.ok) throw new Error(`Failed to fetch version ${versionId}`);
    return res.json();
  }

  async function fetchProjectVersions(projectId, gameVersion, loaderType) {
    const params = new URLSearchParams();
    if (gameVersion) params.append('game_versions', `["${gameVersion}"]`);
    if (loaderType) params.append('loaders', `["${loaderType}"]`);
    params.append('limit', '100');

    const res = await fetch(`${API_BASE}/project/${projectId}/version?${params}`);
    if (!res.ok) throw new Error(`Failed to fetch versions for ${projectId}`);
    return res.json();
  }

  async function fetchProjectTitles(projectIds) {
    if (projectIds.length === 0) return {};
    const idsParam = projectIds.map(id => `"${id}"`).join(',');
    const res = await fetch(`${API_BASE}/projects?ids=[${idsParam}]`);
    if (!res.ok) throw new Error('Failed to fetch project titles');
    const projects = await res.json();
    const titles = {};
    projects.forEach(p => {
      titles[p.id] = p.title || p.slug || p.id;
    });
    return titles;
  }

  function pickBestVersion(versions, gameVersion, loaderType) {
    if (!versions || versions.length === 0) return null;

    // Score versions based on compatibility
    const scored = versions.map(v => {
      let score = 0;
      const hasGameVersion = v.game_versions?.includes(gameVersion);
      const hasLoader = v.loaders?.includes(loaderType);

      if (hasGameVersion) score += 100;
      if (hasLoader) score += 50;

      // Prefer release versions over beta/alpha
      if (v.version_type === 'release') score += 25;
      else if (v.version_type === 'beta') score += 10;

      // Newer versions get higher score (chronological ordering helps)
      const dateScore = new Date(v.date_published).getTime() / 1000000000;
      score += dateScore;

      return { version: v, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.version || null;
  }

  async function recurse(versionId) {
    const version = await fetchVersionDetails(versionId);

    if (!version.dependencies) return;

    for (const dep of version.dependencies) {
      // Incompatible dependency type
      if (dep.dependency_type === 'incompatible') {
        if (dep.project_id && installedProjectIds.has(dep.project_id)) {
          result.warnings.push(
            `Dependency ${dep.project_id} is incompatible with the target version. You may need to uninstall it.`
          );
        }
        continue;
      }

      // Optional dependencies are skipped
      if (dep.dependency_type === 'optional') {
        continue;
      }

      // External/non-Modrinth dependency
      if (!dep.project_id) {
        if (dep.file_name) {
          result.warnings.push(
            `External dependency '${dep.file_name}' cannot be resolved automatically (not on Modrinth).`
          );
        }
        continue;
      }

      // Fabric API on Quilt - skip
      if (dep.project_id === FABRIC_API_PROJECT_ID && loader === 'quilt') {
        continue;
      }

      // Already installed - skip silently
      if (installedProjectIds.has(dep.project_id)) {
        continue;
      }

      // Already queued - check for version conflicts
      if (visitedProjects.has(dep.project_id)) {
        if (dep.version_id && result.to_install[dep.project_id]) {
          const queuedVid = result.to_install[dep.project_id];
          if (queuedVid !== dep.version_id) {
            result.warnings.push(
              `Version conflict for project ${dep.project_id}: already queued version ${queuedVid}, but another dep requests ${dep.version_id}. Keeping the first.`
            );
          }
        }
        continue;
      }

      // Mark as visited before recursing
      visitedProjects.add(dep.project_id);

      // Resolve the version ID
      let resolvedVersionId;
      if (dep.version_id) {
        resolvedVersionId = dep.version_id;
      } else {
        // Fetch compatible versions
        const versions = await fetchProjectVersions(dep.project_id, gameVersion, loader);
        const best = pickBestVersion(versions, gameVersion, loader);
        if (!best) {
          result.warnings.push(
            `No compatible version found for dependency ${dep.project_id} (mc=${gameVersion}, loader=${loader}). Skipping.`
          );
          continue;
        }
        resolvedVersionId = best.id;
      }

      result.to_install[dep.project_id] = resolvedVersionId;
      // Recurse into this dependency's dependencies
      await recurse(resolvedVersionId);
    }
  }

  // Main target - add to install list first
  visitedProjects.add(targetProjectId);
  result.to_install[targetProjectId] = targetVersionId;
  await recurse(targetVersionId);

  // Bulk fetch titles for all projects being installed
  const allIds = Object.keys(result.to_install);
  try {
    result.titles = await fetchProjectTitles(allIds);
  } catch (err) {
    result.warnings.push(`Could not fetch project titles: ${err.message}`);
  }

  // Build modules array with full details needed for install command
  for (const [projectId, versionId] of Object.entries(result.to_install)) {
    try {
      const version = await fetchVersionDetails(versionId);
      const primaryFile = version.files?.find(f => f.primary) || version.files?.[0];

      if (primaryFile) {
        result.modules.push({
          hash: primaryFile.hashes?.sha1 || '',
          project_id: projectId,
          version_id: versionId,
          module_name: result.titles[projectId] || version.name || projectId,
          module_type: 'mod',
          file_name: primaryFile.filename || '',
        });
      }
    } catch (err) {
      result.warnings.push(`Could not fetch details for ${projectId}: ${err.message}`);
    }
  }

  return result;
}

/**
 * Find best version for a project given game version and loader
 * @param {string} projectId - Project ID
 * @param {string} gameVersion - Minecraft version
 * @param {string} loader - Loader type
 * @returns {Promise<Object|null>} Best matching version or null
 */
export async function findBestVersion(projectId, gameVersion, loader) {
  const params = new URLSearchParams();
  if (gameVersion) params.append('game_versions', `["${gameVersion}"]`);
  if (loader) params.append('loaders', `["${loader}"]`);
  params.append('limit', '100');

  const res = await fetch(`${API_BASE}/project/${projectId}/version?${params}`);
  if (!res.ok) return null;

  const versions = await res.json();
  if (!versions || versions.length === 0) return null;

  // Score versions
  const scored = versions.map(v => {
    let score = 0;
    const hasGameVersion = v.game_versions?.includes(gameVersion);
    const hasLoader = v.loaders?.includes(loader);

    if (hasGameVersion) score += 100;
    if (hasLoader) score += 50;
    if (v.version_type === 'release') score += 25;
    else if (v.version_type === 'beta') score += 10;

    const dateScore = new Date(v.date_published).getTime() / 1000000000;
    score += dateScore;

    return { version: v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.version || null;
}

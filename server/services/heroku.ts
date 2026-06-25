const HEROKU_API_KEY = process.env.HEROKU_API_KEY || "";

const herokuHeaders = {
  Authorization: `Bearer ${HEROKU_API_KEY}`,
  Accept: "application/vnd.heroku+json; version=3",
  "Content-Type": "application/json"
};

export async function getTeamAppCount(team: string): Promise<number> {
  const res = await fetch(`https://api.heroku.com/teams/${team}/apps`, { headers: herokuHeaders });
  if (!res.ok) return Infinity;
  const apps = await res.json() as Array<Record<string, unknown>>;
  return apps.length;
}

export async function findBestTeam(teams: string[]): Promise<string | null> {
  let bestTeam: string | null = null;
  let lowestCount = Infinity;
  for (const team of teams) {
    const count = await getTeamAppCount(team);
    if (count < lowestCount) { lowestCount = count; bestTeam = team; }
  }
  return bestTeam;
}

export async function deployBotApp(appName: string, team: string, session: string, phoneNumber: string, isTrial: boolean = false, sourceUrlOverride?: string, envOverrides?: Record<string, string>): Promise<{ success: boolean; setupId?: string }> {
    const sourceUrl = sourceUrlOverride || (isTrial
      ? "https://github.com/xhclintohn/Toxic-MD-Free-Trial/tarball/main"
      : "https://github.com/xhclintohn/Toxic-MD-Paid/tarball/main");
    const env = envOverrides || { SESSION: session, BOT_NAME: appName, OWNER_NUMBER: phoneNumber, HEROKU_API_KEY: HEROKU_API_KEY, HEROKU_APP_NAME: appName };
    const res = await fetch("https://api.heroku.com/app-setups", {
      method: "POST",
      headers: herokuHeaders,
      body: JSON.stringify({
        app: { name: appName, organization: team },
        source_blob: { url: sourceUrl },
        overrides: { env }
      })
    });
    if (!res.ok) return { success: false };
    const data = await res.json() as { id?: string; status?: string };
    return { success: true, setupId: data.id };
  }

export async function getSetupStatus(setupId: string): Promise<{ status: string; build?: Record<string, unknown> }> {
  const res = await fetch(`https://api.heroku.com/app-setups/${setupId}`, { headers: herokuHeaders });
  if (!res.ok) return { status: "unknown" };
  const data = await res.json() as { status?: string; build?: Record<string, unknown> };
  return { status: data.status || "unknown", build: data.build };
}


export async function appExists(appName: string): Promise<boolean> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}`, { headers: herokuHeaders });
  return res.ok;
}

export async function deleteApp(appName: string): Promise<boolean> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}`, { method: "DELETE", headers: herokuHeaders });
  return res.ok || res.status === 404;
}

export async function restartApp(appName: string): Promise<boolean> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}/dynos`, { method: "DELETE", headers: herokuHeaders });
  return res.ok;
}

export async function getAppStatus(appName: string): Promise<string> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}`, { headers: herokuHeaders });
  if (!res.ok) return "unknown";
  const data = await res.json() as { maintenance?: boolean };
  return data.maintenance ? "stopped" : "running";
}

export async function getAppLogs(appName: string): Promise<string> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}/log-sessions`, {
    method: "POST",
    headers: herokuHeaders,
    body: JSON.stringify({ lines: 200, tail: false })
  });
  if (!res.ok) return "No logs available";
  const data = await res.json() as { logplex_url?: string };
  if (!data.logplex_url) return "No logs available";
  const logRes = await fetch(data.logplex_url);
  if (!logRes.ok) return "Failed to fetch logs";
  return await logRes.text();
}

export async function enableMaintenanceMode(appName: string): Promise<boolean> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}`, {
    method: "PATCH",
    headers: herokuHeaders,
    body: JSON.stringify({ maintenance: true })
  });
  return res.ok;
}

export async function disableMaintenanceMode(appName: string): Promise<boolean> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}`, {
    method: "PATCH",
    headers: herokuHeaders,
    body: JSON.stringify({ maintenance: false })
  });
  return res.ok;
}

export async function setConfigVar(appName: string, key: string, value: string): Promise<boolean> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}/config-vars`, {
    method: "PATCH",
    headers: herokuHeaders,
    body: JSON.stringify({ [key]: value })
  });
  return res.ok;
}

  export async function getTeamApps(team: string): Promise<string[]> {
    try {
      const res = await fetch(`https://api.heroku.com/teams/${encodeURIComponent(team)}/apps`, { headers: herokuHeaders });
      if (!res.ok) return [];
      const apps = await res.json() as { name: string }[];
      return apps.map(a => a.name);
    } catch { return []; }
  }
  
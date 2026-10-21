# Client access from the internet

The app runs on this computer at `http://127.0.0.1:3001`. Cloudflare Tunnel supplies the public HTTPS address. The current address is saved in `artifacts/share-url.txt`.

The computer must remain awake, online, and running both the app and tunnel. Client users sign in with their application account, not their Supabase dashboard account. Each application account has separate records; a new account will not automatically see another user's company data.

## Restart after shutdown

Open PowerShell in this project. Build after changing code or `.env.local`, then start the app:

**Stop the running production app before rebuilding, and start it again after the build finishes.** Replacing `.next` while the old server is running can leave HTML referencing CSS/JavaScript files that no longer exist, resulting in an unstyled page. For the background app, use the `$appId` stop commands below; the tunnel can remain running while the app restarts. Then refresh the browser with Ctrl+F5.

```powershell
npm run build
npm run start -- --port 3001
```

Leave that terminal running. In another PowerShell terminal run:

```powershell
cloudflared tunnel --url http://127.0.0.1:3001 --no-autoupdate
```

Share the HTTPS `trycloudflare.com` address printed by cloudflared. Each new tunnel can have a different address. Stop these foreground processes with Ctrl+C in their respective terminals.

## Stop the background preview started by the assistant

Run from the project directory. These checks limit stopping to the recorded preview processes with matching command lines:

```powershell
$tunnelId = [int](Get-Content artifacts/share-tunnel.pid)
$tunnel = Get-CimInstance Win32_Process -Filter "ProcessId = $tunnelId"
if ($tunnel.Name -eq 'cloudflared.exe' -and $tunnel.CommandLine -like '*http://127.0.0.1:3001*') {
  Stop-Process -Id $tunnelId
}
$appId = [int](Get-Content artifacts/share-app.pid)
$app = Get-CimInstance Win32_Process -Filter "ProcessId = $appId"
if ($app.Name -eq 'node.exe' -and $app.CommandLine -like '*next*start*--port 3001*') {
  Stop-Process -Id $appId
}
```

Logs are in `artifacts/share-app*.log` and `artifacts/share-tunnel*.log`. No router port forwarding or firewall opening was configured.

Quick Tunnels are for previews/testing, without an uptime guarantee. For ongoing client use with a fixed URL, configure a named tunnel with your Cloudflare account and domain. See [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).

Verified for this preview: public login page returns HTTP 200, the workspace redirects unauthenticated visitors to login, and the accounting API returns HTTP 401 without a session. A successful client login and authenticated business operations still need verification with the client's account.

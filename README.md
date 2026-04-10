# Beach Companion

Beach Companion is a small beach conditions app published via GitHub Pages.

Live site:
[https://aweitzner.github.io/beach-companion/](https://aweitzner.github.io/beach-companion/)

## Development Workflow

From this project folder:

```bash
cd /Users/andyweitzner/Documents/Program_Files/beach-app
```

Check current changes:

```bash
git status
```

Review changes:

```bash
git diff
```

Commit changes:

```bash
git add .
git commit -m "Describe the change"
```

Push to GitHub:

```bash
git push
```

Pull latest changes if needed:

```bash
git pull --rebase
```

## Deployment

This project is connected to:

```text
https://github.com/aweitzner/beach-companion
```

GitHub Pages serves the app from that repo. After a push, wait for GitHub Pages to redeploy before testing the live site.

## Test Mode

Test Mode is enabled only through the URL query string:

```text
?testMode=1
```

Supported parameters:

```text
testMode=1
simNow=<ISO timestamp>
weatherFixture=<name>
alertsFixture=<name>
tidesFixture=<name>
waterTempFixture=<name>
astronomyFixture=<name>
```

Notes:
- Weather fixture tests are most reliable when `simNow` matches the date used in the fixture data.
- Alerts fixtures can usually be tested without `simNow` as long as the selected day is `Today`.
- If a requested fixture fails to load, the Test Mode banner should show the failure instead of silently falling back to live data.

## Validation URLs

### Alerts

High rip:
[https://aweitzner.github.io/beach-companion/?testMode=1&alertsFixture=rip_high](https://aweitzner.github.io/beach-companion/?testMode=1&alertsFixture=rip_high)

Expected:
- `Rip risk: High`

Moderate beach hazards:
[https://aweitzner.github.io/beach-companion/?testMode=1&alertsFixture=beach_hazards_moderate](https://aweitzner.github.io/beach-companion/?testMode=1&alertsFixture=beach_hazards_moderate)

Expected:
- `Rip risk: Moderate`

No alerts:
[https://aweitzner.github.io/beach-companion/?testMode=1&alertsFixture=no_alerts](https://aweitzner.github.io/beach-companion/?testMode=1&alertsFixture=no_alerts)

Expected:
- no rip note

Unrelated alert:
[https://aweitzner.github.io/beach-companion/?testMode=1&alertsFixture=unrelated_alert](https://aweitzner.github.io/beach-companion/?testMode=1&alertsFixture=unrelated_alert)

Expected:
- no rip note

### Weather

Thunderstorms:
[https://aweitzner.github.io/beach-companion/?testMode=1&simNow=2026-06-20T11:00:00-04:00&weatherFixture=thunderstorms_pm](https://aweitzner.github.io/beach-companion/?testMode=1&simNow=2026-06-20T11:00:00-04:00&weatherFixture=thunderstorms_pm)

Expected:
- thunder/rain note appears

Wind shift:
[https://aweitzner.github.io/beach-companion/?testMode=1&simNow=2026-06-20T11:00:00-04:00&weatherFixture=wind_shift_onshore](https://aweitzner.github.io/beach-companion/?testMode=1&simNow=2026-06-20T11:00:00-04:00&weatherFixture=wind_shift_onshore)

Expected:
- wind shift note appears

Seal conditions:
[https://aweitzner.github.io/beach-companion/?testMode=1&simNow=2026-01-15T14:00:00-05:00&weatherFixture=seal_bad_conditions](https://aweitzner.github.io/beach-companion/?testMode=1&simNow=2026-01-15T14:00:00-05:00&weatherFixture=seal_bad_conditions)

Expected:
- on Sandy Hook only, `Seals unlikely: wind/rough seas`

Null precip should skip:
[https://aweitzner.github.io/beach-companion/?testMode=1&simNow=2026-06-20T11:00:00-04:00&weatherFixture=precip_null_should_skip](https://aweitzner.github.io/beach-companion/?testMode=1&simNow=2026-06-20T11:00:00-04:00&weatherFixture=precip_null_should_skip)

Expected:
- no precipitation note from that fixture

### Mixed Mode

Thunderstorms plus high rip:
[https://aweitzner.github.io/beach-companion/?testMode=1&simNow=2026-06-20T11:00:00-04:00&weatherFixture=thunderstorms_pm&alertsFixture=rip_high](https://aweitzner.github.io/beach-companion/?testMode=1&simNow=2026-06-20T11:00:00-04:00&weatherFixture=thunderstorms_pm&alertsFixture=rip_high)

Expected:
- both sources are active
- banner shows both fixtures
- notes still follow normal priority ordering

### Failure Handling

Missing weather fixture:
[https://aweitzner.github.io/beach-companion/?testMode=1&weatherFixture=does_not_exist](https://aweitzner.github.io/beach-companion/?testMode=1&weatherFixture=does_not_exist)

Expected:
- no silent fallback
- console error
- Test Mode banner shows the fixture failure

Missing alerts fixture:
[https://aweitzner.github.io/beach-companion/?testMode=1&alertsFixture=does_not_exist](https://aweitzner.github.io/beach-companion/?testMode=1&alertsFixture=does_not_exist)

Expected:
- no silent fallback
- console error
- Test Mode banner shows the fixture failure

### Normal Mode

Production mode:
[https://aweitzner.github.io/beach-companion/](https://aweitzner.github.io/beach-companion/)

Expected:
- no Test Mode banner
- no fixture behavior
- normal live app behavior

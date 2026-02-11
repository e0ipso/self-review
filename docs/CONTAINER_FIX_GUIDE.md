# Container E2E Test Fix Guide

## Changes Applied

### Updated `/workspace/.devcontainer/devcontainer.json`

Added security options to bypass AppArmor restrictions:

```json
"runArgs": [
  "--cap-add=NET_ADMIN",
  "--cap-add=NET_RAW",
  "--cap-add=SYS_ADMIN",
  "--security-opt=seccomp=unconfined",
  "--security-opt=apparmor=unconfined",  // NEW: Disables AppArmor restrictions
  "--ipc=host"                             // NEW: Enables proper IPC for Electron
]
```

**What these do:**
- `--security-opt=apparmor=unconfined` - Disables AppArmor restrictions that prevent Electron from creating user namespaces
- `--ipc=host` - Enables shared memory access needed for Chromium's multiprocess architecture

### Already Configured

From previous updates:
- ✅ Improved Xvfb startup with 2-second initialization delay
- ✅ DBus session daemon auto-start
- ✅ All required graphics libraries installed

## How to Apply Changes

### Method 1: Rebuild Container (Recommended)

If using VS Code:
1. Open Command Palette (`Cmd/Ctrl + Shift + P`)
2. Run: `Dev Containers: Rebuild Container`
3. Wait for rebuild to complete
4. Container will restart with new security settings

### Method 2: Manual Rebuild

If using Docker CLI:
```bash
# Stop current container
docker stop <container-name>

# Remove container (keeps volumes)
docker rm <container-name>

# Rebuild with updated config
docker build -f .devcontainer/Dockerfile -t devcontainer .
docker run --cap-add=NET_ADMIN --cap-add=NET_RAW --cap-add=SYS_ADMIN \
  --security-opt=seccomp=unconfined \
  --security-opt=apparmor=unconfined \
  --ipc=host \
  -v $(pwd):/workspace \
  devcontainer
```

### Method 3: Claude Code CLI

If using Claude Code:
```bash
# Rebuild will happen automatically on next container start
# Or manually trigger with:
code .  # Reopen in container
```

## Verification Steps

After rebuilding, verify the fix:

### 1. Check AppArmor is Disabled
```bash
# This should now show "unconfined" instead of a profile name
cat /proc/self/attr/current
```

### 2. Test Xvfb Display
```bash
# Verify display is accessible
ps aux | grep Xvfb  # Should show running process
```

### 3. Run Single E2E Test
```bash
# Test one that was previously failing
npx playwright test --grep "Not a git repository" --timeout=30000
```

Expected: Test should now pass

### 4. Run Full E2E Suite
```bash
npm run test:e2e
```

Expected: All 54 tests should pass

## Troubleshooting

### If Tests Still Fail

**Check Container Security Settings:**
```bash
docker inspect <container-id> | grep -A 5 SecurityOpt
```

Should show:
```json
"SecurityOpt": [
  "seccomp=unconfined",
  "apparmor=unconfined"
]
```

**Verify IPC Mode:**
```bash
docker inspect <container-id> | grep IpcMode
```

Should show: `"IpcMode": "host"`

### If AppArmor Cannot Be Disabled

Some environments (managed CI, corporate Docker) may prevent `apparmor=unconfined`. In that case:

**Option A: Request Exception**
Contact your IT/DevOps team to allow this security setting for development containers.

**Option B: Run Tests Outside Container**
```bash
# On host machine
npm run test:e2e
```

**Option C: Use Different CI Platform**
GitHub Actions, GitLab CI, and CircleCI typically allow these settings.

## Security Implications

**What `apparmor=unconfined` means:**
- Disables AppArmor mandatory access control for this container
- Container processes run with fewer restrictions
- Still isolated from host by Docker's other security layers (namespaces, cgroups, etc.)

**Is this safe for development?**
- ✅ **Yes** - Standard for Electron/Chromium development containers
- ✅ **Yes** - Only affects this specific container, not host or other containers
- ✅ **Yes** - Temporary; only applied during development

**For production:**
- ❌ **Do not** run production containers with `apparmor=unconfined`
- ❌ **Do not** use this configuration in production environments
- ✅ **Do** use proper AppArmor profiles for production deployments

## Expected Results After Fix

### Before Fix
```
Running 54 tests using 1 worker
  ✓ 6 passed
  ✘ 48 failed (timeout)
```

### After Fix
```
Running 54 tests using 1 worker
  ✓ 54 passed
```

## Additional Resources

- [Docker Security AppArmor](https://docs.docker.com/engine/security/apparmor/)
- [Electron Testing in Containers](https://www.electronjs.org/docs/latest/tutorial/testing-on-headless-ci)
- [Dev Containers Security](https://containers.dev/implementors/json_reference/#general-properties)

## Support

If issues persist after applying these changes, check:
1. `/workspace/docs/E2E_TEST_INVESTIGATION.md` - Full investigation report
2. Container logs: `docker logs <container-id>`
3. Electron output: `ELECTRON_ENABLE_LOGGING=1 npm run test:e2e`

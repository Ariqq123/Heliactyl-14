# Heliactyl Changelog

## 14.11.2 (2026-05-25)

### Added
- **Admin User List Page:** New `/users` route for admins to view all users with complete details (Discord ID, email, package, coins, servers, extra resources).
- **Security Enhancements:**
    - Improved account removal process: Now blocks deletion if user has active servers in Pterodactyl.
    - Fixed IP leak: Duplicate IP lock (`ipuser-<ip>`) is now properly cleaned when account is removed.
    - SSO Security: Added session revalidation and improved fallbacks for `/panel` SSO entry point to prevent 500 errors.
    - Root/Login Redirect: Logged-in users are now automatically redirected to `/dashboard` instead of seeing the login page.

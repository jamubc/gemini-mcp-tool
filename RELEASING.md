# Release Checklist

**⚠️ This is for maintainers only**

## Release Steps

1. [ ] Pull latest main: `git pull origin main`
2. [ ] Run build: `npm run build`
3. [ ] Test with MCP client locally
4. [ ] Update version: `npm version patch/minor/major`
5. [ ] Update CHANGELOG.md
6. [ ] Push changes: `git push origin main`
7. [ ] Push tags: `git push --tags`
8. [ ] Publish to npm: `npm publish`
9. [ ] Create GitHub release from tag
# Syncing Template Updates

Instructions for syncing upstream template changes into an instance of this repository.

## 1. Add Template Remote (One-Time Setup)

```bash
git remote add template https://github.com/jitinnair1/codebook.git
```

## 2. Fetch and Merge Upstream Changes

```bash
git fetch template
git merge template/main --allow-unrelated-histories
```

## 3. Resolve Conflicts and Commit

Resolve any merge conflicts if prompted, then commit the merge:

```bash
git commit
```

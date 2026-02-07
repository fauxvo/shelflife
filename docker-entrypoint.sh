#!/bin/sh
set -e

# Fix ownership of the data directory.
# When a host volume is mounted (e.g. on Unraid), it's typically owned by root,
# which the nextjs user (uid 1001) can't write to.
chown nextjs:nodejs /app/data

exec su-exec nextjs "$@"

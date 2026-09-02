# DEPRECATED - no longer used.
#
# start.bat now deploys the pack itself on every launch (a clean delete +
# real-file copy into server\behavior_packs\EnchantedShop_BP, followed by
# tools\activate-pack.ps1 to activate it on the world) instead of relying on
# a directory junction here. The junction approach turned out to be exactly
# the kind of thing that goes silently wrong: when it's broken,
# bedrock_server.exe just loads zero behavior packs with no error ("Pack
# Stack - None" in the log) rather than failing loudly.
#
# This file could not be deleted from this environment (delete permission
# for the connected folder could not be obtained) - it is safe to delete it
# yourself; nothing references it anymore.
Write-Host "[link-dev-pack] Deprecated and unused - see the comment at the top of this file. Safe to delete."

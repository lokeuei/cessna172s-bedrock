# Manual recovery if a script is disabled while a player has seat input locks.
inputpermission set @s lateral_movement enabled
inputpermission set @s jump enabled
camera @s clear
event entity @s skyhawk:seat_off

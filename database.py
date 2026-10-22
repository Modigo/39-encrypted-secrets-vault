def has_permission(role, action):
    permissions = {
        "admin": ["create", "read", "update", "delete"],
        "user": ["create", "read"]
    }

    if role not in permissions:
        return False

    if action in permissions[role]:
        return True
    else:
        return False
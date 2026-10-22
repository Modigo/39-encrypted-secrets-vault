from datetime import datetime, timezone
import json
import os


def save_log(filename="audit_log.json"):
    with open(filename, "w") as f:
        json.dump(audit_log, f, indent=2)


audit_log = []


def record_event(user, action, secret_name, outcome):
    audit_log.append({
        "user": user,
        "action": action,
        "secret": secret_name,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "outcome": outcome,
    })


admins = {"admin"}

secrets = {
    "db_password": {"owner": "alice", "value": "old-pass-123", "version": 1, "history": []},
}


def rotate_secret(user, name, new_value):
    secret = secrets.get(name)
    if secret is None:
        record_event(user, "rotate", name, "failed: not found")
        return False

    if user != secret["owner"] and user not in admins:
        record_event(user, "rotate", name, "denied")
        return False

    secret["history"].append({
        "version": secret["version"],
        "rotated_by": user,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    if not new_value:
        record_event(user, "rotate", name, "failed: empty value")
        return False
    if new_value == secret["value"]:
        record_event(user, "rotate", name, "failed: same value")
        return False
    secret["value"] = new_value
    secret["version"] += 1
    record_event(user, "rotate", name, "success")
    return True


def get_history(name):
    secret = secrets.get(name)
    if secret is None:
        return None
    return secret["history"]


def filter_log(outcome=None, user=None):
    results = audit_log
    if outcome:
        results = [e for e in results if e["outcome"] == outcome]
    if user:
        results = [e for e in results if e["user"] == user]
    return results


def read_secret(user, name):
    secret = secrets.get(name)
    if secret is None:
        record_event(user, "read", name, "failed: not found")
        return None

    if user != secret["owner"] and user not in admins:
        record_event(user, "read", name, "denied")
        return None

    record_event(user, "read", name, "success")
    return secret["value"]


def load_log(filename="audit_log.json"):
    if os.path.exists(filename):
        with open(filename) as f:
            audit_log.extend(json.load(f))


def get_version(name):
    secret = secrets.get(name)
    if secret is None:
        return None
    return secret["version"]


if __name__ == "__main__":
    load_log()
    rotate_secret("alice", "db_password", "new-pass-456")
    rotate_secret("bob", "db_password", "hacked")
    rotate_secret("admin", "db_password", "admin-pass-789")
    read_secret("bob", "db_password")
    print(rotate_secret("admin", "db_password", "admin-pass-789"))
    print(get_version("db_password"))
    save_log()

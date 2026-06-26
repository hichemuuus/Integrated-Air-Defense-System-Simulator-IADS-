class BaselinePolicy:
    def select_engagements(self, threats, in_flight, inventory_remaining, max_concurrent, **kwargs):
        slots = min(max_concurrent - in_flight, inventory_remaining)
        if slots <= 0:
            return []
        return [t["track_id"] for t in threats[:slots]]


class PriorityPolicy:
    """Spec-approved: ETA bands, jammed-first, swarm-first within band."""
    def select_engagements(self, threats, in_flight, inventory_remaining, max_concurrent, **kwargs):
        slots = min(max_concurrent - in_flight, inventory_remaining)
        if slots <= 0:
            return []

        def urgency_band(eta):
            if eta < 20:
                return 0    # critical
            if eta < 40:
                return 1    # urgent
            return 2        # standard

        def sort_key(c):
            return (
                urgency_band(c["eta"]),
                0 if c["jammed"] else 1,                   # jammed first within band
                0 if c["track_type"] == "SWARM" else 1,    # swarm before single
                c["eta"],
            )

        selected = sorted(threats, key=sort_key)[:slots]
        return [t["track_id"] for t in selected]


class PriorityPolicyUnjammedFirst:
    """A/B variant: unjammed-first within ETA bands, keeping bands + swarm-first.

    Same as PriorityPolicy except jammed status tiebreak is reversed:
    unjammed (higher Pk) before jammed (lower Pk) within each band.
    """
    def select_engagements(self, threats, in_flight, inventory_remaining, max_concurrent, **kwargs):
        slots = min(max_concurrent - in_flight, inventory_remaining)
        if slots <= 0:
            return []

        def urgency_band(eta):
            if eta < 20:
                return 0
            if eta < 40:
                return 1
            return 2

        def sort_key(c):
            return (
                urgency_band(c["eta"]),
                1 if c["jammed"] else 0,                   # unjammed first (reversed)
                0 if c["track_type"] == "SWARM" else 1,    # swarm before single
                c["eta"],
            )

        selected = sorted(threats, key=sort_key)[:slots]
        return [t["track_id"] for t in selected]

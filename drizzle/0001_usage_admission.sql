CREATE TABLE vp_usage_guard (
  id TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('mint', 'view', 'start')),
  network TEXT NOT NULL,
  session TEXT NOT NULL,
  at INTEGER NOT NULL,
  minute INTEGER NOT NULL,
  hour INTEGER NOT NULL,
  day INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX vp_usage_guard_expiry ON vp_usage_guard(expires_at);
--> statement-breakpoint
CREATE TABLE vp_usage_budget (
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  total INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (kind, name, bucket)
);
--> statement-breakpoint
CREATE INDEX vp_usage_budget_expiry ON vp_usage_budget(expires_at);
--> statement-breakpoint
CREATE TRIGGER vp_usage_check_budget BEFORE INSERT ON vp_usage_guard
WHEN NOT EXISTS (SELECT 1 FROM vp_usage_guard WHERE id = NEW.id) BEGIN
  SELECT RAISE(ABORT, 'usage_quota') WHERE
    COALESCE((SELECT total FROM vp_usage_budget WHERE kind='all' AND name='*' AND bucket=NEW.day),0) >= 20000
    OR (NEW.kind='mint' AND (
      COALESCE((SELECT total FROM vp_usage_budget WHERE kind='mint-day' AND name='*' AND bucket=NEW.day),0) >= 3000
      OR COALESCE((SELECT total FROM vp_usage_budget WHERE kind='mint-minute' AND name=NEW.network AND bucket=NEW.minute),0) >= 12
      OR COALESCE((SELECT total FROM vp_usage_budget WHERE kind='mint-hour' AND name=NEW.network AND bucket=NEW.hour),0) >= 120
    ))
    OR (NEW.kind!='mint' AND (
      COALESCE((SELECT total FROM vp_usage_budget WHERE kind='event-network' AND name=NEW.network AND bucket=NEW.minute),0) >= 240
      OR COALESCE((SELECT total FROM vp_usage_budget WHERE kind='event-session' AND name=NEW.session AND bucket=NEW.minute),0) >= 60
    ));
END;
--> statement-breakpoint
CREATE TRIGGER vp_usage_record_budget AFTER INSERT ON vp_usage_guard BEGIN
  INSERT INTO vp_usage_budget VALUES ('all','*',NEW.day,1,NEW.at+172800)
    ON CONFLICT(kind,name,bucket) DO UPDATE SET total=total+1;
  INSERT INTO vp_usage_budget SELECT 'mint-day','*',NEW.day,1,NEW.at+172800 WHERE NEW.kind='mint'
    ON CONFLICT(kind,name,bucket) DO UPDATE SET total=total+1;
  INSERT INTO vp_usage_budget SELECT 'mint-minute',NEW.network,NEW.minute,1,NEW.at+172800 WHERE NEW.kind='mint'
    ON CONFLICT(kind,name,bucket) DO UPDATE SET total=total+1;
  INSERT INTO vp_usage_budget SELECT 'mint-hour',NEW.network,NEW.hour,1,NEW.at+172800 WHERE NEW.kind='mint'
    ON CONFLICT(kind,name,bucket) DO UPDATE SET total=total+1;
  INSERT INTO vp_usage_budget SELECT 'event-network',NEW.network,NEW.minute,1,NEW.at+172800 WHERE NEW.kind!='mint'
    ON CONFLICT(kind,name,bucket) DO UPDATE SET total=total+1;
  INSERT INTO vp_usage_budget SELECT 'event-session',NEW.session,NEW.minute,1,NEW.at+172800 WHERE NEW.kind!='mint'
    ON CONFLICT(kind,name,bucket) DO UPDATE SET total=total+1;
  DELETE FROM vp_usage_guard WHERE id IN (SELECT id FROM vp_usage_guard WHERE expires_at<NEW.at LIMIT 32);
  DELETE FROM vp_usage_budget WHERE (kind,name,bucket) IN
    (SELECT kind,name,bucket FROM vp_usage_budget WHERE expires_at<NEW.at LIMIT 32);
END;

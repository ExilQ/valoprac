CREATE TABLE vp_usage_day (
  day TEXT NOT NULL,
  test INTEGER NOT NULL,
  metric TEXT NOT NULL,
  item TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, test, metric, item)
);
--> statement-breakpoint
CREATE TABLE vp_usage_session (
  id TEXT PRIMARY KEY,
  test INTEGER NOT NULL,
  landing_day TEXT NOT NULL,
  landing_path TEXT NOT NULL,
  source TEXT NOT NULL,
  seen_day TEXT NOT NULL,
  path TEXT NOT NULL,
  view_seq INTEGER NOT NULL DEFAULT 0,
  started INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX vp_usage_session_seen ON vp_usage_session(seen_day);
--> statement-breakpoint
CREATE TRIGGER vp_record_visit AFTER INSERT ON vp_usage_session BEGIN
  INSERT INTO vp_usage_day VALUES (NEW.landing_day, NEW.test, 'visit', '*', 1)
  ON CONFLICT DO UPDATE SET total = total + 1;
  INSERT INTO vp_usage_day VALUES (NEW.landing_day, NEW.test, 'source', NEW.source, 1)
  ON CONFLICT DO UPDATE SET total = total + 1;
  INSERT INTO vp_usage_day VALUES (NEW.landing_day, NEW.test, 'landing', NEW.landing_path, 1)
  ON CONFLICT DO UPDATE SET total = total + 1;
  DELETE FROM vp_usage_session WHERE seen_day < date(NEW.landing_day, '-1 day');
END;
--> statement-breakpoint
CREATE TRIGGER vp_record_page_view AFTER UPDATE OF view_seq ON vp_usage_session
WHEN NEW.view_seq > OLD.view_seq BEGIN
  INSERT INTO vp_usage_day VALUES (NEW.seen_day, NEW.test, 'pageview', NEW.path, 1)
  ON CONFLICT DO UPDATE SET total = total + 1;
END;
--> statement-breakpoint
CREATE TRIGGER vp_record_start AFTER UPDATE OF started ON vp_usage_session
WHEN OLD.started = 0 AND NEW.started = 1 BEGIN
  INSERT INTO vp_usage_day VALUES (NEW.landing_day, NEW.test, 'training_start', NEW.landing_path, 1)
  ON CONFLICT DO UPDATE SET total = total + 1;
END;

from __future__ import annotations
import os
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from datetime import datetime, date
from dateutil import parser as dateparser

from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from sqlalchemy import create_engine, select, and_, func
from sqlalchemy import Integer, String, Date, Text, DateTime
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped, Session

APP_PORT = 8080
ACCESS_CODE = os.environ.get("ACCESS_CODE", "")
MONTHS_AHEAD = int(os.environ.get("MONTHS_AHEAD", "6"))  # default 6
DATABASE_URL = os.environ.get("DATABASE_URL")

def normalize_db_url(u: str|None) -> str:
    if not u:
        os.makedirs("data", exist_ok=True)
        return "sqlite:///data/bookings.sqlite"
    if u.startswith("postgres://"):
        u = u.replace("postgres://", "postgresql+psycopg2://", 1)
    elif u.startswith("postgresql://") and not u.startswith("postgresql+psycopg2://"):
        u = u.replace("postgresql://", "postgresql+psycopg2://", 1)
    parsed = urlparse(u)
    q = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if "sslmode" not in q:
        q["sslmode"] = "require"
    u = urlunparse(parsed._replace(query=urlencode(q)))
    return u

DATABASE_URL = normalize_db_url(DATABASE_URL)
engine = create_engine(DATABASE_URL, future=True)

class Base(DeclarativeBase):
    pass

class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120))
    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[date] = mapped_column(Date, index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)  # legacy
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(engine)

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

def ymd(d: date|datetime) -> str:
    return d.strftime("%Y-%m-%d")

def parse_ymd(s: str) -> date:
    return dateparser.parse(s).date()

@app.route("/")
def index():
    return render_template("index.html", months_ahead=MONTHS_AHEAD)

@app.get("/api/bookings")
def list_bookings():
    q_from = request.args.get("from")
    q_to = request.args.get("to")
    with Session(engine) as s:
        stmt = select(Booking)
        if q_from and q_to:
            f = parse_ymd(q_from)
            t = parse_ymd(q_to)
            stmt = stmt.where(and_(Booking.start_date <= t, Booking.end_date >= f))
        stmt = stmt.order_by(Booking.start_date.asc())
        rows = s.execute(stmt).scalars().all()
        data = [{
            "id": r.id,
            "name": r.name,
            "start_date": ymd(r.start_date),
            "end_date": ymd(r.end_date),
            "note": r.note or "",
            "created_at": r.created_at.isoformat()
        } for r in rows]
    return jsonify(data)

@app.post("/api/bookings")
def create_booking():
    payload = request.get_json(force=True) or {}
    name = (payload.get("name") or "").strip()
    if ACCESS_CODE:
        code = (payload.get("code") or "").strip()
        if code != ACCESS_CODE:
            return jsonify({"error":"invalid_code"}), 401
    if not name or not payload.get("start") or not payload.get("end"):
        return jsonify({"error":"missing_fields"}), 400

    start = parse_ymd(payload.get("start"))
    end   = parse_ymd(payload.get("end"))
    if end < start:
        return jsonify({"error":"range"}), 400

    with Session(engine) as s:
        conflict = s.execute(
            select(Booking.id).where(
                and_(Booking.start_date <= end, Booking.end_date >= start)
            ).limit(1)
        ).first()
        if conflict:
            return jsonify({"error":"conflict"}), 409
        b = Booking(name=name, start_date=start, end_date=end, note=None)
        s.add(b); s.commit(); s.refresh(b)
        return jsonify({"id": b.id, "name": b.name, "start_date": ymd(b.start_date), "end_date": ymd(b.end_date), "note": b.note or "", "created_at": b.created_at.isoformat()}), 201

@app.put("/api/bookings/<int:booking_id>")
def update_booking(booking_id: int):
    payload = request.get_json(force=True) or {}
    if ACCESS_CODE:
        code = (payload.get("code") or "").strip()
        if code != ACCESS_CODE:
            return jsonify({"error":"invalid_code"}), 401
    name = (payload.get("name") or "").strip()
    if not name or not payload.get("start") or not payload.get("end"):
        return jsonify({"error":"missing_fields"}), 400
    start = parse_ymd(payload.get("start")); end = parse_ymd(payload.get("end"))
    if end < start: return jsonify({"error":"range"}), 400

    with Session(engine) as s:
        conflict = s.execute(
            select(Booking.id).where(
                and_(Booking.id != booking_id, Booking.start_date <= end, Booking.end_date >= start)
            ).limit(1)
        ).first()
        if conflict: return jsonify({"error":"conflict"}), 409
        b = s.get(Booking, booking_id)
        if not b: return jsonify({"error":"not_found"}), 404
        b.name = name; b.start_date = start; b.end_date = end
        s.commit(); s.refresh(b)
        return jsonify({"id": b.id, "name": b.name, "start_date": ymd(b.start_date), "end_date": ymd(b.end_date), "note": b.note or "", "created_at": b.created_at.isoformat()})

@app.delete("/api/bookings/<int:booking_id>")
def delete_booking(booking_id: int):
    if ACCESS_CODE:
        code = (request.args.get("code") or "").strip()
        if code != ACCESS_CODE:
            return jsonify({"error":"invalid_code"}), 401
    with Session(engine) as s:
        b = s.get(Booking, booking_id)
        if b: s.delete(b); s.commit()
    return ("", 204)

@app.get("/health")
def health():
    try:
        with Session(engine) as s:
            s.execute(select(func.count(Booking.id))).scalar_one()
        ok = True
    except Exception:
        ok = False
    return {"ok": ok}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=APP_PORT)

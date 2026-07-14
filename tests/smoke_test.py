"""
Production smoke test for the Practice Log API.

Covers:
  - DB connectivity health check
  - Full happy-path CRUD chain: Topic -> Problem -> Attempt
  - Error cases: 404s on missing resources, 404 on bad FK references,
    409 conflicts on cascade-blocked deletes

By design, this script leaves its main test data (one topic, one problem,
one attempt) in the production DB afterward, so you can inspect it via
/docs or the frontend. It does still exercise the DELETE endpoints, but
only against extra throwaway records created just for that purpose.

Usage:
    pip install requests
    python test_practice_log_api.py
"""

import sys
import requests

BASE_URL = "https://practice-log.up.railway.app"

results = []


def check(name, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    results.append((name, status, detail))
    print(f"[{status}] {name}" + (f" -- {detail}" if detail and status == "FAIL" else ""))
    return condition


def run(name, fn):
    """Run a test function, catching any exception as a FAIL rather than crashing the script."""
    try:
        fn()
    except Exception as e:
        check(name, False, f"raised {type(e).__name__}: {e}")


def main():
    session = requests.Session()

    # ---------------------------------------------------------------
    # 1. Health check
    # ---------------------------------------------------------------
    def health_check():
        r = session.get(f"{BASE_URL}/health/db")
        check("GET /health/db returns 200", r.status_code == 200, f"status={r.status_code}")
        if r.status_code == 200:
            body = r.json()
            check("DB reports connected", body.get("db_status") == "connected", str(body))

    run("health_check", health_check)

    # ---------------------------------------------------------------
    # 2. Topic happy path
    # ---------------------------------------------------------------
    topic_id = {}

    def create_topic():
        r = session.post(f"{BASE_URL}/topics", json={"name": "Smoke Test Topic"})
        check("POST /topics returns 201", r.status_code == 201, f"status={r.status_code} body={r.text}")
        if r.status_code == 201:
            topic_id["value"] = r.json()["id"]

    run("create_topic", create_topic)

    def get_all_topics():
        r = session.get(f"{BASE_URL}/topics")
        check("GET /topics returns 200", r.status_code == 200, f"status={r.status_code}")
        check("GET /topics returns a list", isinstance(r.json(), list))

    run("get_all_topics", get_all_topics)

    def get_one_topic():
        r = session.get(f"{BASE_URL}/topics/{topic_id['value']}")
        check("GET /topics/{id} returns 200", r.status_code == 200, f"status={r.status_code}")
        check("GET /topics/{id} returns correct name", r.json().get("name") == "Smoke Test Topic")

    run("get_one_topic", get_one_topic)

    def update_topic():
        r = session.put(f"{BASE_URL}/topics/{topic_id['value']}", json={"name": "Smoke Test Topic (updated)"})
        check("PUT /topics/{id} returns 200", r.status_code == 200, f"status={r.status_code}")
        check("PUT /topics/{id} reflects new name", r.json().get("name") == "Smoke Test Topic (updated)")

    run("update_topic", update_topic)

    # ---------------------------------------------------------------
    # 3. Problem happy path
    # ---------------------------------------------------------------
    problem_id = {}

    def create_problem():
        r = session.post(
            f"{BASE_URL}/problems",
            json={"name": "Smoke Test Problem", "topic_id": topic_id["value"]},
        )

        check("POST /problems returns 201", r.status_code == 201, f"status={r.status_code} body={r.text}")
        if r.status_code == 201:
            problem_id["value"] = r.json()["id"]

    run("create_problem", create_problem)

    def get_problems_filtered():
        r = session.get(f"{BASE_URL}/problems", params={"topic_id": topic_id["value"]})
        check("GET /problems?topic_id= returns 200", r.status_code == 200, f"status={r.status_code}")
        ids = [p["id"] for p in r.json()] if r.status_code == 200 else []
        check("Filtered problems include the created one", problem_id.get("value") in ids)

    run("get_problems_filtered", get_problems_filtered)

    def get_one_problem():
        r = session.get(f"{BASE_URL}/problems/{problem_id['value']}")
        check("GET /problems/{id} returns 200", r.status_code == 200, f"status={r.status_code}")

    run("get_one_problem", get_one_problem)

    def update_problem():
        r = session.put(
            f"{BASE_URL}/problems/{problem_id['value']}",
            json={"name": "Smoke Test Problem (updated)", "topic_id": topic_id["value"]},
        )
        check("PUT /problems/{id} returns 200", r.status_code == 200, f"status={r.status_code} body={r.text}")

    run("update_problem", update_problem)

    # ---------------------------------------------------------------
    # 4. Attempt happy path
    # ---------------------------------------------------------------
    attempt_id = {}

    def create_attempt():
        r = session.post(
            f"{BASE_URL}/attempts",
            json={"problem_id": problem_id["value"], "status": "completed"},
        )
        check("POST /attempts returns 201", r.status_code == 201, f"status={r.status_code} body={r.text}")
        if r.status_code == 201:
            attempt_id["value"] = r.json()["id"]

    run("create_attempt", create_attempt)

    def get_attempts_filtered():
        r = session.get(f"{BASE_URL}/attempts", params={"prob_id": problem_id["value"]})
        check("GET /attempts?prob_id= returns 200", r.status_code == 200, f"status={r.status_code}")

    run("get_attempts_filtered", get_attempts_filtered)

    def get_one_attempt():
        r = session.get(f"{BASE_URL}/attempts/{attempt_id['value']}")
        check("GET /attempts/{id} returns 200", r.status_code == 200, f"status={r.status_code}")

    run("get_one_attempt", get_one_attempt)

    def update_attempt():
        r = session.put(
            f"{BASE_URL}/attempts/{attempt_id['value']}",
            json={"problem_id": problem_id["value"], "status": "completed"},
        )
        check("PUT /attempts/{id} returns 200", r.status_code == 200, f"status={r.status_code} body={r.text}")

    run("update_attempt", update_attempt)

    # ---------------------------------------------------------------
    # 5. Error cases: 404s on missing resources
    # ---------------------------------------------------------------
    NONEXISTENT_ID = 99999999

    def missing_topic_404():
        r = session.get(f"{BASE_URL}/topics/{NONEXISTENT_ID}")
        check("GET /topics/{bad_id} returns 404", r.status_code == 404, f"status={r.status_code}")

    run("missing_topic_404", missing_topic_404)

    def missing_problem_404():
        r = session.get(f"{BASE_URL}/problems/{NONEXISTENT_ID}")
        check("GET /problems/{bad_id} returns 404", r.status_code == 404, f"status={r.status_code}")

    run("missing_problem_404", missing_problem_404)

    def missing_attempt_404():
        r = session.get(f"{BASE_URL}/attempts/{NONEXISTENT_ID}")
        check("GET /attempts/{bad_id} returns 404", r.status_code == 404, f"status={r.status_code}")

    run("missing_attempt_404", missing_attempt_404)

    # ---------------------------------------------------------------
    # 6. Error cases: bad FK references
    # ---------------------------------------------------------------
    def bad_fk_problem():
        r = session.post(f"{BASE_URL}/problems", json={"name": "Orphan Problem", "topic_id": NONEXISTENT_ID})
        check("POST /problems with bad topic_id returns 404", r.status_code == 404, f"status={r.status_code}")

    run("bad_fk_problem", bad_fk_problem)

    def bad_fk_attempt():
        r = session.post(f"{BASE_URL}/attempts", json={"problem_id": NONEXISTENT_ID, "status": "completed"})
        check("POST /attempts with bad problem_id returns 404", r.status_code == 404, f"status={r.status_code}")

    run("bad_fk_attempt", bad_fk_attempt)

    # ---------------------------------------------------------------
    # 7. Error cases: 409 conflict on cascade-blocked deletes
    # ---------------------------------------------------------------
    def conflict_delete_topic():
        # topic_id["value"] still has problem_id["value"] referencing it
        r = session.delete(f"{BASE_URL}/topics/{topic_id['value']}")
        check("DELETE /topics/{id} with child problem returns 409", r.status_code == 409, f"status={r.status_code}")

    run("conflict_delete_topic", conflict_delete_topic)

    def conflict_delete_problem():
        # problem_id["value"] still has attempt_id["value"] referencing it
        r = session.delete(f"{BASE_URL}/problems/{problem_id['value']}")
        check("DELETE /problems/{id} with child attempt returns 409", r.status_code == 409, f"status={r.status_code}")

    run("conflict_delete_problem", conflict_delete_problem)

    # ---------------------------------------------------------------
    # 8. DELETE happy path -- exercised on separate throwaway records
    #    so the main topic/problem/attempt chain above is left intact
    #    for you to inspect afterward.
    # ---------------------------------------------------------------
    def delete_happy_path():
        r = session.post(f"{BASE_URL}/topics", json={"name": "Throwaway Delete-Test Topic"})
        check("POST /topics (throwaway) returns 201", r.status_code == 201, f"status={r.status_code}")
        if r.status_code != 201:
            return
        throwaway_id = r.json()["id"]

        r = session.delete(f"{BASE_URL}/topics/{throwaway_id}")
        check("DELETE /topics/{id} with no children returns 204", r.status_code == 204, f"status={r.status_code}")

        r = session.get(f"{BASE_URL}/topics/{throwaway_id}")
        check("GET deleted topic now returns 404", r.status_code == 404, f"status={r.status_code}")

    run("delete_happy_path", delete_happy_path)

    # ---------------------------------------------------------------
    # Summary
    # ---------------------------------------------------------------
    print("\n" + "=" * 60)
    passed = sum(1 for _, status, _ in results if status == "PASS")
    failed = sum(1 for _, status, _ in results if status == "FAIL")
    print(f"Results: {passed} passed, {failed} failed, {len(results)} total")
    if failed:
        print("\nFailed checks:")
        for name, status, detail in results:
            if status == "FAIL":
                print(f"  - {name}: {detail}")
    print("=" * 60)

    if topic_id.get("value"):
        print(f"\nLeftover data for inspection: topic_id={topic_id['value']}, "
              f"problem_id={problem_id.get('value')}, attempt_id={attempt_id.get('value')}")

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
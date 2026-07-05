#!/usr/bin/env python3
"""
IDSD Holdout Set evaluator for GAP-19: auto-create group chat channel.

This script is AI-visible. The actual scenario descriptions live in
holdout/scenarios/ and are shielded from the build-time agent via
.claudeignore (project root).

Usage:
    python evaluate.py <version_tag>
    python evaluate.py gap19-v1
"""

import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Literal

Status = Literal["PASS", "FAIL", "SKIP"]


class ScenarioEvaluator:
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.holdout_dir = Path(__file__).parent
        self.results_dir = self.holdout_dir / "results"
        self.results_dir.mkdir(exist_ok=True)
        self.config = json.loads((self.holdout_dir / "runner-config.json").read_text())

    def load_scenarios(self, category: str) -> List[Dict]:
        category_dir = self.holdout_dir / "scenarios" / category
        scenarios: List[Dict] = []
        if not category_dir.exists():
            return scenarios
        for file in sorted(category_dir.glob("*.md")):
            scenarios.append(
                {
                    "name": file.stem,
                    "category": category,
                    "description": file.read_text(encoding="utf-8"),
                }
            )
        return scenarios

    def run_command(self, cmd: str, cwd: Path, timeout: int = 120) -> bool:
        print(f"  Running: {cmd}")
        try:
            result = subprocess.run(
                cmd,
                cwd=cwd,
                shell=True,
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            if result.returncode != 0:
                print(f"  FAILED (exit {result.returncode}):")
                print(result.stdout[-800:])
                print(result.stderr[-800:])
                return False
            return True
        except subprocess.TimeoutExpired:
            print(f"  TIMEOUT after {timeout}s")
            return False

    def evaluate_scenario(self, scenario: Dict) -> Status:
        print(f"\n  Scenario: {scenario['name']} ({scenario['category']})")

        # For the first version of this pilot, evaluation is semi-automated:
        # 1. Run the test suite to ensure no regressions.
        # 2. Run typecheck.
        # 3. Future iterations will add API-level assertions here.
        if not self.run_command(self.config["test_command"], self.project_root):
            return "FAIL"
        if not self.run_command(self.config["typecheck_command"], self.project_root):
            return "FAIL"

        return "PASS"

    def run_all(self) -> Dict:
        results = {
            "total": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "scenarios": [],
            "timestamp": int(time.time()),
        }

        for category in ["success", "failure", "boundary"]:
            scenarios = self.load_scenarios(category)
            for scenario in scenarios:
                status = self.evaluate_scenario(scenario)
                results["total"] += 1
                if status == "PASS":
                    results["passed"] += 1
                elif status == "FAIL":
                    results["failed"] += 1
                else:
                    results["skipped"] += 1
                results["scenarios"].append(
                    {
                        "name": scenario["name"],
                        "category": category,
                        "status": status,
                    }
                )

        return results

    def save_results(self, results: Dict, version: str):
        output_file = self.results_dir / f"{version}.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        print(f"\nResults saved: {output_file}")

    def print_summary(self, results: Dict):
        print("\n" + "=" * 50)
        print("IDSD Holdout Set Evaluation — GAP-19")
        print("=" * 50)
        print(f"Total scenarios: {results['total']}")
        print(f"Passed:          {results['passed']} ✅")
        print(f"Failed:          {results['failed']} ❌")
        print(f"Skipped:         {results['skipped']} ⏭️")
        if results["total"] > 0:
            print(f"Pass rate:       {results['passed']/results['total']*100:.1f}%")
        print("=" * 50)


def main():
    if len(sys.argv) < 2:
        print("Usage: python evaluate.py <version_tag>")
        print("Example: python evaluate.py gap19-v1")
        sys.exit(1)

    version = sys.argv[1]
    project_root = Path(__file__).parent.parent.parent.parent

    evaluator = ScenarioEvaluator(project_root)
    results = evaluator.run_all()
    evaluator.save_results(results, version)
    evaluator.print_summary(results)

    if results["failed"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()

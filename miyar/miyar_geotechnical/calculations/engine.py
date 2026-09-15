"""Pluggable, versioned formula evaluator (§ 12).

The BRD requires a versioned, admin-managed "Business Formula" registry rather
than hard-coded SBC 303 math, since the actual engineering equations
(bearing capacity, settlement, borehole-count, etc.) are not published in the
source documents. This module only evaluates whatever expression an admin has
configured on a `Business Formula` record — it does not itself encode any
engineering formula.

Expressions are restricted to arithmetic (+ - * / // % **), comparisons, and
boolean operators over named inputs, evaluated via `ast` (never Python's
`eval`/`exec` on raw source) so a formula can never reach outside its inputs.
"""

import ast
import operator

_ALLOWED_BINOPS = {
	ast.Add: operator.add,
	ast.Sub: operator.sub,
	ast.Mult: operator.mul,
	ast.Div: operator.truediv,
	ast.FloorDiv: operator.floordiv,
	ast.Mod: operator.mod,
	ast.Pow: operator.pow,
}
_ALLOWED_UNARYOPS = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_ALLOWED_COMPARE = {
	ast.Lt: operator.lt,
	ast.LtE: operator.le,
	ast.Gt: operator.gt,
	ast.GtE: operator.ge,
	ast.Eq: operator.eq,
	ast.NotEq: operator.ne,
}
_ALLOWED_FUNCS = {"min": min, "max": max, "abs": abs, "round": round}


class FormulaError(Exception):
	pass


def evaluate_expression(expression: str, context: dict):
	"""Safely evaluate `expression` using only names present in `context`."""
	try:
		tree = ast.parse(expression, mode="eval")
	except SyntaxError as e:
		raise FormulaError(f"Invalid expression syntax: {e}")
	return _eval_node(tree.body, context)


def _eval_node(node, context):
	if isinstance(node, ast.Constant):
		if isinstance(node.value, (int, float)):
			return node.value
		raise FormulaError("Only numeric constants are allowed")
	if isinstance(node, ast.Name):
		if node.id not in context:
			raise FormulaError(f"Unknown variable '{node.id}'")
		return context[node.id]
	if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_BINOPS:
		return _ALLOWED_BINOPS[type(node.op)](_eval_node(node.left, context), _eval_node(node.right, context))
	if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_UNARYOPS:
		return _ALLOWED_UNARYOPS[type(node.op)](_eval_node(node.operand, context))
	if isinstance(node, ast.Compare) and len(node.ops) == 1 and type(node.ops[0]) in _ALLOWED_COMPARE:
		left = _eval_node(node.left, context)
		right = _eval_node(node.comparators[0], context)
		return _ALLOWED_COMPARE[type(node.ops[0])](left, right)
	if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in _ALLOWED_FUNCS:
		args = [_eval_node(a, context) for a in node.args]
		return _ALLOWED_FUNCS[node.func.id](*args)
	raise FormulaError(f"Expression uses a disallowed construct: {ast.dump(node)}")

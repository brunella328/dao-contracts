import { BigInt } from "@graphprotocol/graph-ts";
import {
  TaskPosted, TaskAccepted, TaskSubmitted,
  TaskVerified, TaskDisputed, TaskSettled, TaskCancelled
} from "../../generated/TaskMarket/TaskMarket";
import { Task } from "../../generated/schema";

export function handleTaskPosted(event: TaskPosted): void {
  let task = new Task(event.params.taskId.toString());
  task.client = event.params.client;
  task.assignee = null;
  task.reward = event.params.reward;
  task.status = "Pending";
  task.postedAt = event.block.timestamp;
  task.deadline = BigInt.fromI32(0); // populated from contract call if needed
  task.descriptionHash = event.params.descHash;
  task.resultHash = null;
  task.verifiedAt = null;
  task.payoutAmount = null;
  task.save();
}

export function handleTaskAccepted(event: TaskAccepted): void {
  let task = Task.load(event.params.taskId.toString());
  if (!task) return;
  task.assignee = event.params.agent;
  task.status = "Active";
  task.save();
}

export function handleTaskSubmitted(event: TaskSubmitted): void {
  let task = Task.load(event.params.taskId.toString());
  if (!task) return;
  task.resultHash = event.params.resultHash;
  task.status = "Submitted";
  task.save();
}

export function handleTaskVerified(event: TaskVerified): void {
  let task = Task.load(event.params.taskId.toString());
  if (!task) return;
  task.status = "Verified";
  task.verifiedAt = event.block.timestamp;
  task.payoutAmount = event.params.payout;
  task.save();
}

export function handleTaskDisputed(event: TaskDisputed): void {
  let task = Task.load(event.params.taskId.toString());
  if (!task) return;
  task.status = "Disputed";
  task.save();
}

export function handleTaskSettled(event: TaskSettled): void {
  let task = Task.load(event.params.taskId.toString());
  if (!task) return;
  task.status = "Settled";
  task.save();
}

export function handleTaskCancelled(event: TaskCancelled): void {
  let task = Task.load(event.params.taskId.toString());
  if (!task) return;
  task.status = "Cancelled";
  task.save();
}

import {
  ChallengeOpened, ChallengeResolved
} from "../../generated/OptimisticChallenge/OptimisticChallenge";
import { Challenge } from "../../generated/schema";

export function handleChallengeOpened(event: ChallengeOpened): void {
  let challenge = new Challenge(event.params.challengeId.toString());
  challenge.taskId = event.params.taskId;
  challenge.challenger = event.params.challenger;
  challenge.challengerStake = event.transaction.value; // approximation
  challenge.openedAt = event.block.timestamp;
  challenge.resolved = false;
  challenge.challengerWon = null;
  challenge.arbitrator = null;
  challenge.save();
}

export function handleChallengeResolved(event: ChallengeResolved): void {
  let challenge = Challenge.load(event.params.challengeId.toString());
  if (!challenge) return;
  challenge.resolved = true;
  challenge.challengerWon = event.params.challengerWon;
  challenge.arbitrator = event.params.arbitrator;
  challenge.save();
}

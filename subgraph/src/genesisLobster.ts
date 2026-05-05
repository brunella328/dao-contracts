import {
  LobsterMinted
} from "../../generated/GenesisLobster/GenesisLobster";
import { LobsterMint } from "../../generated/schema";

export function handleLobsterMinted(event: LobsterMinted): void {
  let mint = new LobsterMint(event.params.tokenId.toString());
  mint.agent = event.params.agent;
  mint.taskId = event.params.taskId;
  mint.serial = event.params.tokenId;
  mint.mintedAt = event.block.timestamp;
  mint.save();
}

// SPDX-License-Identifier: DUDE
pragma solidity ^0.8.10;

contract Raffle {

    struct Player {
        uint balance;
        uint lastActivityTimestamp;
        uint accruedValue;
    }

    event Deposited(address indexed player, uint amount, uint timestamp);
    event Withdrawn(address indexed player, uint amount, uint timestamp);

    error ZeroBalance();
    error WithdrawalFailed();

    mapping (address => Player) players;
    uint totalDeposited;
    uint totalAccruedValue;

    function withdraw(uint amount) external {

        if (players[msg.sender].balance == 0) {
            revert ZeroBalance();
        }

        if (amount > players[msg.sender].balance) {
            amount = players[msg.sender].balance;
        }

        emit Withdrawn(msg.sender, amount, block.timestamp);
        totalDeposited -= amount;
        updatePlayer(amount, false);

        (bool sent, ) = msg.sender.call{value: amount}('');
        if (!sent) {
            revert WithdrawalFailed();
        }
    }

    receive() external payable {

        emit Deposited(msg.sender, msg.value, block.timestamp);
        totalDeposited += msg.value;
        updatePlayer(msg.value, true);
    }

    function updatePlayer(uint amount, bool isDeposit) internal {

        players[msg.sender].accruedValue = calculateAccruedValue(msg.sender);
        players[msg.sender].lastActivityTimestamp = block.timestamp;
        isDeposit ? players[msg.sender].balance += amount : players[msg.sender].balance -= amount;

        totalAccruedValue += players[msg.sender].accruedValue;
    }

    function calculateAccruedValue(address account) public view returns (uint) {

        return players[account].accruedValue + (block.timestamp - players[msg.sender].lastActivityTimestamp) * players[msg.sender].balance;
    }

    function generateRandomNumber(uint16 ceiling) public view returns (uint16) {

        return uint16(uint(blockhash(block.number - 1)) % ceiling);
    }
}
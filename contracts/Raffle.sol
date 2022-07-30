// SPDX-License-Identifier: DUDE
pragma solidity ^0.8.10;

import '@aave/core-v3/contracts/interfaces/IPool.sol';
import '@aave/periphery-v3/contracts/misc/interfaces/IWETHGateway.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';

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

    IPool immutable pool;
    IWETHGateway immutable wethGateway;
    IERC20 immutable aweth;
    
    mapping (address => Player) public players;
    uint public totalDeposited;
    uint public totalAccruedValue;

    constructor(address poolAddress, address wethGatewayAddress, address awethAddress) {

        pool = IPool(poolAddress);
        wethGateway = IWETHGateway(wethGatewayAddress);
        aweth = IERC20(awethAddress);
    }

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

        aweth.approve(address(wethGateway), amount);
        wethGateway.withdrawETH(address(pool), amount, msg.sender); // gateway withdraws directly to the user
    }

    receive() external payable {

        emit Deposited(msg.sender, msg.value, block.timestamp);
        totalDeposited += msg.value;
        updatePlayer(msg.value, true);

        // wrap ETH and deposit to Aave on behalf of this contract
        wethGateway.depositETH{value: msg.value}(address(pool), address(this), 0);
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
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { mine, time } from '@nomicfoundation/hardhat-network-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, ContractFactory } from 'ethers'

import { POOL_ADDRESS, WETH_GATEWAY_ADDRESS, AWETH_ADDRESS } from '../app.config'

describe('Raffle', function () {

    let raffleFactory: ContractFactory
    let raffle: Contract
    let aweth: Contract
    let user: SignerWithAddress

    const amount = ethers.utils.parseEther('1').toBigInt()
    const mineOptions = { interval: 20 }

    before(async function () {
        [user] = await ethers.getSigners()
        raffleFactory = await ethers.getContractFactory('Raffle', user)
        aweth = await ethers.getContractAt('IERC20', AWETH_ADDRESS, user)
    })

    beforeEach(async function () {
        raffle = await raffleFactory.deploy(POOL_ADDRESS, WETH_GATEWAY_ADDRESS, AWETH_ADDRESS)
        await raffle.deployed()
    })

    it('Contract obtains aWETH after user deposits ETH', async function () {

        const transaction = await user.sendTransaction({ to: raffle.address, value: amount })

        expect(transaction).to.changeEtherBalance(user.address, -amount)
        expect(await aweth.balanceOf(raffle.address)).to.be.equal(amount)
    })

    it('Contract earns interest after holding aWETH for 8 minutes', async function () {

        await user.sendTransaction({ to: raffle.address, value: amount })
        const aWethBalanceStart = await aweth.balanceOf(raffle.address)

        expect(aWethBalanceStart).to.be.equal(amount)
        
        await mine(24, mineOptions) // 24 blocks with 3 blocks per minute = 8 minutes
        const aWethBalanceEnd = await aweth.balanceOf(raffle.address)

        expect(aWethBalanceEnd).to.be.greaterThan(aWethBalanceStart)
    })

    it('User deposits then withdraws ETH', async function () {

        await user.sendTransaction({ to: raffle.address, value: amount })
        const userBalance = (await raffle.players(user.address)).balance.toBigInt()

        // withdrawing more than available balance will cap the amount to total outstanding balance
        expect(await raffle.withdraw(userBalance * 2n)).to.changeEtherBalance(user, userBalance)
    })

    it('Reverts an attempt to withdraw from account with 0 balance', async function() {
        
        await expect(raffle.withdraw(amount)).to.be.revertedWithCustomError(raffle, 'ZeroBalance')
    })

    it('Emits event after deposit and withdrawal', async function () {

        const transactionDeposit = await user.sendTransaction({ to: raffle.address, value: amount })
        let timestampDeposit = await time.latest()

        expect(transactionDeposit).to.emit(raffle, 'Deposited').withArgs(user.address, amount, timestampDeposit)

        const transactionWithdrawal = await user.sendTransaction({ to: raffle.address, value: amount })
        let timestampWithdrawal = await time.latest()

        expect(transactionWithdrawal).to.emit(raffle, 'Withdrawn').withArgs(user.address, amount, timestampWithdrawal)
    })

    it('Calculates accrued value of a new account', async function () {

        const accruedValue = await raffle.calculateAccruedValue(user.address)
        
        expect(accruedValue).to.be.equal(0)
    })

    it('Calculates accrued value after holding a deposit for 1 hour', async function () {

        await user.sendTransaction({ to: raffle.address, value: amount })
        await mine(181, mineOptions) // initial 1 block plus 180 subsequent blocks of 20 seconds per block = 1 hour and 1 second
        const accruedValue = await raffle.calculateAccruedValue(user.address)
        
        expect(accruedValue).to.be.equal(amount * (60n * 60n + 1n)) // add 1 second for the initial block when user transferred ETH
    })

    it('Calculates accrued value after multiple deposits and withdrawals', async function () {

        const ONE_ETH_ONE_HOUR = amount * (60n * 60n)
        let accruedValue
        let expectedAccruedValue

        accruedValue = await raffle.calculateAccruedValue(user.address)
        expectedAccruedValue = 0n
        
        expect(accruedValue).to.be.equal(expectedAccruedValue)

        await user.sendTransaction({ to: raffle.address, value: 2n * amount })
        await mine(360 + 1, mineOptions) // interval 1: 2 ETH * 2 hours = 4 ETH hours
        accruedValue = await raffle.calculateAccruedValue(user.address)
        expectedAccruedValue += 4n * ONE_ETH_ONE_HOUR + 2n * amount
        
        expect(accruedValue).to.be.equal(expectedAccruedValue)

        await raffle.withdraw(amount)
        await mine(180 + 1, mineOptions) // interval 2: 1 ETH * 1 hour = 1 ETH hour
        accruedValue = await raffle.calculateAccruedValue(user.address)
        expectedAccruedValue += 1n * ONE_ETH_ONE_HOUR + 3n * amount
        
        expect(accruedValue).to.be.equal(expectedAccruedValue)

        await user.sendTransaction({ to: raffle.address, value: amount })
        await mine(180 + 1, mineOptions) // interval 3: 2 ETH * 1 hour = 2 ETH hour
        accruedValue = await raffle.calculateAccruedValue(user.address)
        expectedAccruedValue += 2n * ONE_ETH_ONE_HOUR + 3n * amount
        
        expect(accruedValue).to.be.equal(expectedAccruedValue)
        
        await raffle.withdraw(amount * 2n)
        await mine(180 + 1, mineOptions) // interval 4: 0 ETH * 1 hour = 0 ETH hours
        accruedValue = await raffle.calculateAccruedValue(user.address)
        expectedAccruedValue += 2n * amount // total accrued: 7 ETH hours + 10 ETH seconds
        
        expect(accruedValue).to.be.equal(expectedAccruedValue)
    })

    it('Generates 8 random numbers below the requested ceiling', async function () {

        const ceiling = 8

        for (let i = 1; i <= 8; i++) {
            await mine()
            const randomNumber = await raffle.generateRandomNumber(ceiling)
            
            expect(randomNumber).to.be.lessThan(ceiling)
        }
    })
})  
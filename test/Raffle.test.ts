import { expect } from 'chai'
import { ethers } from 'hardhat'
import { mine, time } from '@nomicfoundation/hardhat-network-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, ContractFactory } from 'ethers'

describe('Raffle', function () {

    let raffleFactory: ContractFactory
    let raffle: Contract
    let user: SignerWithAddress

    const amount = ethers.utils.parseEther('1').toBigInt()
    const mineOptions = { interval: 20 }

    before(async function () {
        [user] = await ethers.getSigners()
        raffleFactory = await ethers.getContractFactory('Raffle', user)
    })

    beforeEach(async function () {
        raffle = await raffleFactory.deploy()
        await raffle.deployed()
    })

    it('Deposits and withdraws balance', async function() {
        
        await user.sendTransaction({ to: raffle.address, value: amount * 2n })
        expect(await ethers.provider.getBalance(raffle.address)).to.changeEtherBalances([raffle, user], [amount * 2n, -amount * 2n])

        await raffle.withdraw(amount)
        expect(await ethers.provider.getBalance(raffle.address)).to.changeEtherBalances([raffle, user], [amount, -amount])

        await raffle.withdraw(amount * 2n) // withdrawing more than available balance will cap the amount to total outstanding balance
        expect(await ethers.provider.getBalance(raffle.address)).to.changeEtherBalances([raffle, user], [amount, -amount])
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
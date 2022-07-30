import { ethers } from 'hardhat'
import { POOL_ADDRESS, WETH_GATEWAY_ADDRESS, AWETH_ADDRESS } from '../app.config'

async function main () {

    const raffleFactory = await ethers.getContractFactory('Raffle')
    const raffle = await raffleFactory.deploy(POOL_ADDRESS, WETH_GATEWAY_ADDRESS, AWETH_ADDRESS)

    console.log(`Transaction ${raffle.deployTransaction.hash} is deploying contract ${raffle.address}`)
    await raffle.deployed()
    console.log('Contract successfully deployed')
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
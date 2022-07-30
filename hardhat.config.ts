import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'

import { ALCHEMY_API_KEY, PRIVATE_KEYS } from './.credentials'

const GOERLI_URL = `https://eth-goerli.alchemyapi.io/v2/${ALCHEMY_API_KEY}`

const config: HardhatUserConfig = {
    solidity: '0.8.10',

    networks: {
        hardhat: {
            forking: {
                url: GOERLI_URL,
                blockNumber: 7316700,
            },
        },
        goerli: {
            url: GOERLI_URL,
            accounts: PRIVATE_KEYS,
        },
        'optimism-kovan': {
            url: 'https://kovan.optimism.io',
            accounts: PRIVATE_KEYS,
        },
    }
}

export default config

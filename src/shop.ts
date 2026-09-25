import { createPublicClient, http, isAddress } from 'viem'
import { sepolia } from 'viem/chains'

export const storeAddress = isAddress(import.meta.env.VITE_STORE_ADDRESS ?? '')
  ? import.meta.env.VITE_STORE_ADDRESS as `0x${string}`
  : undefined

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'),
})

export const shopAbi = [
  {
    type: 'function', name: 'PRICE', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'hasHat', stateMutability: 'view',
    inputs: [{ name: 'buyer', type: 'address' }], outputs: [{ type: 'bool' }],
  },
  {
    type: 'function', name: 'purchaseHat', stateMutability: 'payable',
    inputs: [], outputs: [],
  },
] as const

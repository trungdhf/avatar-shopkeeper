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
    type: 'function', name: 'GLASSES_PRICE', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'hasGlasses', stateMutability: 'view',
    inputs: [{ name: 'buyer', type: 'address' }], outputs: [{ type: 'bool' }],
  },
  {
    type: 'function', name: 'purchaseGlasses', stateMutability: 'payable',
    inputs: [], outputs: [],
  },
  {
    type: 'function', name: 'purchaseHat', stateMutability: 'payable',
    inputs: [], outputs: [],
  },
  // Version 2 contract only: gifting. The first deployment has none of these,
  // so the app reads VERSION and hides the gift field when the call fails.
  {
    type: 'function', name: 'VERSION', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'purchaseHatFor', stateMutability: 'payable',
    inputs: [{ name: 'to', type: 'address' }], outputs: [],
  },
  {
    type: 'function', name: 'purchaseGlassesFor', stateMutability: 'payable',
    inputs: [{ name: 'to', type: 'address' }], outputs: [],
  },
] as const

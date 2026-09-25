import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createEVM } from '@ethereumjs/evm'
import { bytesToHex, createAccount, createAddressFromString, hexToBytes } from '@ethereumjs/util'
import { decodeFunctionResult, encodeFunctionData } from 'viem'
import solc from 'solc'

const source = readFileSync(new URL('../contracts/AvatarShop.sol', import.meta.url), 'utf8')
const output = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity',
  sources: { 'AvatarShop.sol': { content: source } },
  settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
})))
assert.deepEqual(output.errors?.filter((issue) => issue.severity === 'error') ?? [], [])
const artifact = output.contracts['AvatarShop.sol'].AvatarShop

async function deploy() {
  const evm = await createEVM()
  const owner = createAddressFromString('0x00000000000000000000000000000000000000a1')
  const buyer = createAddressFromString('0x00000000000000000000000000000000000000b2')
  const other = createAddressFromString('0x00000000000000000000000000000000000000c3')
  for (const address of [owner, buyer, other]) {
    await evm.stateManager.putAccount(address, createAccount({ balance: 10n ** 18n }))
  }

  const deployment = await evm.runCall({
    caller: owner, data: hexToBytes(`0x${artifact.evm.bytecode.object}`), gasLimit: 10_000_000n,
  })
  assert.equal(deployment.execResult.exceptionError, undefined)
  const address = deployment.createdAddress
  assert.ok(address)

  async function call(caller, functionName, args = [], value = 0n) {
    return evm.runCall({
      caller, to: address, gasLimit: 1_000_000n, value,
      data: hexToBytes(encodeFunctionData({ abi: artifact.abi, functionName, args })),
    })
  }

  async function read(caller, functionName, args = []) {
    const result = await call(caller, functionName, args)
    assert.equal(result.execResult.exceptionError, undefined)
    return decodeFunctionResult({ abi: artifact.abi, functionName, data: bytesToHex(result.execResult.returnValue) })
  }

  return { evm, owner, buyer, other, address, call, read }
}

test('a wallet buys one cap, other wallets remain independent, and only owner withdraws', async () => {
  const { evm, owner, buyer, other, address, call, read } = await deploy()

  const price = await read(owner, 'PRICE')
  assert.equal(price, 100_000_000_000_000n)
  assert.equal(await read(buyer, 'hasHat', [buyer.toString()]), false)

  const underpaid = await call(buyer, 'purchaseHat', [], price - 1n)
  assert.ok(underpaid.execResult.exceptionError)
  assert.equal(await read(buyer, 'hasHat', [buyer.toString()]), false)

  const purchased = await call(buyer, 'purchaseHat', [], price)
  assert.equal(purchased.execResult.exceptionError, undefined)
  assert.equal(purchased.execResult.logs?.length, 1)
  assert.equal(await read(buyer, 'hasHat', [buyer.toString()]), true)
  assert.equal(await read(other, 'hasHat', [other.toString()]), false)

  const duplicate = await call(buyer, 'purchaseHat', [], price)
  assert.ok(duplicate.execResult.exceptionError)
  assert.equal((await evm.stateManager.getAccount(address)).balance, price)

  const secondPurchase = await call(other, 'purchaseHat', [], price)
  assert.equal(secondPurchase.execResult.exceptionError, undefined)
  assert.equal(await read(other, 'hasHat', [other.toString()]), true)

  const unauthorized = await call(other, 'withdraw')
  assert.ok(unauthorized.execResult.exceptionError)
  assert.equal((await evm.stateManager.getAccount(address)).balance, price * 2n)

  const ownerBefore = (await evm.stateManager.getAccount(owner)).balance
  const withdrawal = await call(owner, 'withdraw')
  assert.equal(withdrawal.execResult.exceptionError, undefined)
  assert.equal((await evm.stateManager.getAccount(address)).balance, 0n)
  assert.equal((await evm.stateManager.getAccount(owner)).balance, ownerBefore + price * 2n)
})

test('glasses are a separate entitlement from the cap', async () => {
  const { evm, owner, buyer, other, address, call, read } = await deploy()
  const price = await read(owner, 'GLASSES_PRICE')
  assert.equal(price, 100_000_000_000_000n)
  assert.equal(await read(buyer, 'hasGlasses', [buyer.toString()]), false)

  const overpaid = await call(buyer, 'purchaseGlasses', [], price + 1n)
  assert.ok(overpaid.execResult.exceptionError)
  assert.equal(await read(buyer, 'hasGlasses', [buyer.toString()]), false)

  const purchased = await call(buyer, 'purchaseGlasses', [], price)
  assert.equal(purchased.execResult.exceptionError, undefined)
  assert.equal(purchased.execResult.logs?.length, 1)
  assert.equal(await read(buyer, 'hasGlasses', [buyer.toString()]), true)
  assert.equal(await read(buyer, 'hasHat', [buyer.toString()]), false)
  assert.equal(await read(other, 'hasGlasses', [other.toString()]), false)

  const duplicate = await call(buyer, 'purchaseGlasses', [], price)
  assert.ok(duplicate.execResult.exceptionError)

  const cap = await call(buyer, 'purchaseHat', [], await read(owner, 'PRICE'))
  assert.equal(cap.execResult.exceptionError, undefined)
  assert.equal(await read(buyer, 'hasHat', [buyer.toString()]), true)
  assert.equal(await read(buyer, 'hasGlasses', [buyer.toString()]), true)
  assert.equal((await evm.stateManager.getAccount(address)).balance, price * 2n)
})

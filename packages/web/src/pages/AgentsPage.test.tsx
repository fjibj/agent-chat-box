import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentsPage } from './AgentsPage';

describe('AgentsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url === '/api/machines') {
        return Promise.resolve({ json: () => Promise.resolve({ machines: [{ id: 'm1', name: 'Machine 1', status: 'online' }] }) } as Response);
      }
      if (url === '/api/agents' && !init) {
        return Promise.resolve({ json: () => Promise.resolve({ agents: [{ id: 'a1', machineId: 'm1', name: 'Agent 1', runtime: 'claude', status: 'awake', labels: ['python', 'review'] }] }) } as Response);
      }
      if (url === '/api/agents' && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'a2', machineId: 'm1', name: 'Agent 2', runtime: 'codex', status: 'sleeping', labels: ['python', 'review'] }) } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
  });

  it('renders labels on agent cards', async () => {
    render(<AgentsPage />);

    await waitFor(() => expect(screen.getByText('Agent 1')).toBeDefined());
    expect(screen.getByText('python')).toBeDefined();
    expect(screen.getByText('review')).toBeDefined();
  });

  it('submits trimmed and deduplicated labels when adding an agent', async () => {
    const user = userEvent.setup();
    render(<AgentsPage />);

    await waitFor(() => expect(screen.getByText('Machine 1')).toBeDefined());
    await user.click(screen.getByText('+ Add Agent'));
    await user.selectOptions(screen.getByLabelText('Machine'), 'm1');
    await user.type(screen.getByLabelText('Name'), 'Agent 2');
    await user.selectOptions(screen.getByLabelText('Runtime'), 'codex');
    await user.type(screen.getByLabelText('Labels'), 'python, review, python,  ');
    await user.click(screen.getByText('Add'));

    await waitFor(() => {
      const postCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(call => call[0] === '/api/agents' && call[1]?.method === 'POST');
      expect(postCall).toBeDefined();
      expect(JSON.parse(postCall![1]!.body as string).labels).toEqual(['python', 'review']);
    });
  });
});

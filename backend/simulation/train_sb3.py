import os
import sys
import time
import argparse
import numpy as np
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import CheckpointCallback
from stable_baselines3.common.vec_env import SubprocVecEnv
from stable_baselines3.common.env_util import make_vec_env

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from simulation.gym_env.env import IADSGymEnv

N_ENVS = min(os.cpu_count() or 1, 8)

def train(total_timesteps=1000000, model_dir=None, seed=None):
    if model_dir is None:
        model_dir = os.path.join(os.path.dirname(__file__), 'models')
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, 'ppo_iads.zip')

    vec_env = make_vec_env(
        IADSGymEnv, n_envs=N_ENVS, vec_env_cls=SubprocVecEnv, seed=seed,
    )

    ckpt_path = os.path.join(model_dir, 'ppo_iads.zip')
    if os.path.exists(ckpt_path):
        print(f"Resuming from checkpoint: {ckpt_path}")
        model = PPO.load(ckpt_path, env=vec_env, device='cpu', learning_rate=0.0001)
        remaining = total_timesteps - model.num_timesteps
        if remaining <= 0:
            print(f"Model already trained for {model.num_timesteps} timesteps (target: {total_timesteps}). Nothing to do.")
            vec_env.close()
            return model_path
        print(f"Already trained: {model.num_timesteps} steps, remaining: {remaining} steps")
    else:
        print("No checkpoint found. Starting fresh training.")
        model = PPO(
            'MlpPolicy',
            vec_env,
            verbose=1,
            device='cpu',
            learning_rate=0.0001,
            n_steps=4096,
            batch_size=512,
            n_epochs=10,
            gamma=0.99,
            gae_lambda=0.95,
            clip_range=0.2,
            ent_coef=0.01,
            policy_kwargs=dict(net_arch=[256, 256]),
        )
        remaining = total_timesteps

    safe_ckpt = CheckpointCallback(
        save_freq=50_000,
        save_path='./models/',
        name_prefix='ppo_iads_safe',
    )

    start = time.time()
    model.learn(total_timesteps=remaining, callback=safe_ckpt)
    elapsed = time.time() - start

    model.save(model_path)
    print(f"\nModel saved to {model_path}")
    print(f"Training time: {elapsed:.1f}s")
    print(f"  {N_ENVS} parallel envs")
    print(f"  {total_timesteps} total timesteps ({total_timesteps / max(elapsed, 0.1):.0f} steps/s)")

    vec_env.close()
    return model_path


def main():
    parser = argparse.ArgumentParser(description="Train SB3 PPO agent for IADS")
    parser.add_argument("--timesteps", type=int, default=1000000,
                        help="total training timesteps (default 1000000)")
    parser.add_argument("--model-dir", default=None,
                        help="directory for model output")
    parser.add_argument("--seed", type=int, default=None,
                        help="random seed for reproducibility")
    args = parser.parse_args()

    path = train(total_timesteps=args.timesteps, model_dir=args.model_dir,
                 seed=args.seed)
    print(f"Trained model: {path}")


if __name__ == "__main__":
    main()
